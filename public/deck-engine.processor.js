/**
 * DeckEngineProcessor - AudioWorklet-based audio playback engine
 *
 * This processor runs in the audio rendering thread for sample-accurate,
 * glitch-free playback. It is completely isolated from the main thread.
 *
 * Architecture:
 * - Receives audio buffers via postMessage
 * - Writes playhead position to SharedArrayBuffer for low-latency UI sync
 * - Handles transport controls (play, pause, seek, cue)
 * - Zero allocation in process() loop for real-time performance
 *
 * NOTE: This is the compiled JavaScript version for AudioWorklet loading.
 * The source TypeScript is at src/modules/audio/worklet/deck-engine.processor.ts
 */

// SharedArrayBuffer layout - must match usePlayheadSync.ts
const SAB_LAYOUT = {
  SEQUENCE: 0,           // Int32 (4 bytes) - sequence counter for atomic consistency
  // 4 bytes padding for Float64 alignment
  PLAYHEAD_POSITION: 8,  // Float64 (8 bytes)
  SAMPLE_RATE: 16,       // Float64 (8 bytes)
  DURATION: 24,          // Float64 (8 bytes)
  IS_PLAYING: 32,        // Int32 (4 bytes)
};

/**
 * Inline PlayheadWriter for SharedArrayBuffer updates.
 * Cannot import from main thread modules in AudioWorklet context.
 */
class PlayheadWriter {
  constructor(sab) {
    this.int32View = new Int32Array(sab);
    this.dataView = new DataView(sab);
  }

  /** Atomic update of all playhead data */
  update(position, sampleRate, duration, isPlaying) {
    // Begin write - increment sequence to odd (write in progress)
    Atomics.add(this.int32View, SAB_LAYOUT.SEQUENCE / 4, 1);

    // Write all values
    this.dataView.setFloat64(SAB_LAYOUT.PLAYHEAD_POSITION, position, true);
    this.dataView.setFloat64(SAB_LAYOUT.SAMPLE_RATE, sampleRate, true);
    this.dataView.setFloat64(SAB_LAYOUT.DURATION, duration, true);
    Atomics.store(this.int32View, SAB_LAYOUT.IS_PLAYING / 4, isPlaying ? 1 : 0);

    // End write - increment sequence to even (write complete)
    Atomics.add(this.int32View, SAB_LAYOUT.SEQUENCE / 4, 1);
  }
}

/**
 * DeckEngineProcessor - Sample-accurate audio playback in AudioWorklet
 *
 * Key features:
 * - High-priority audio thread execution
 * - SharedArrayBuffer for <16ms playhead sync
 * - Transport controls: play, pause, seek, cue
 * - Loop region support
 * - Graceful buffer underrun handling (outputs silence)
 */
class DeckEngineProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Audio buffer storage - pre-allocated for zero-allocation in process()
    this.channelData = [];
    this.bufferDuration = 0;
    this.bufferSampleRate = 44100;

    // Playback state
    this.playhead = 0;
    this.isPlaying = false;
    this.cuePoint = 0;

    // Loop state
    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    // Track whether buffer is loaded
    this.bufferLoaded = false;

    // Initialize SAB writer if provided in processor options
    const sab = options?.processorOptions?.sharedArrayBuffer;
    console.log('[DeckEngineProcessor] Constructor - SAB received:', !!sab, sab);
    if (sab) {
      this.playheadWriter = new PlayheadWriter(sab);
      console.log('[DeckEngineProcessor] PlayheadWriter created');
    } else {
      this.playheadWriter = null;
      console.warn('[DeckEngineProcessor] No SAB provided - playhead sync will not work!');
    }

    // Set up message handler for commands from main thread
    this.port.onmessage = this.handleMessage.bind(this);

    // Notify main thread that processor is ready
    this.port.postMessage({ type: 'READY' });
  }

  /**
   * Process audio - called ~344 times/second (128 samples at 44.1kHz)
   *
   * CRITICAL: Zero allocation in this method for real-time performance.
   * Do not create objects, arrays, or closures here.
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }

    const outputLength = output[0].length;

    // Output silence if not playing or no buffer loaded
    if (!this.isPlaying || !this.bufferLoaded || this.channelData.length === 0) {
      for (let ch = 0; ch < output.length; ch++) {
        const channelOutput = output[ch];
        for (let i = 0; i < outputLength; i++) {
          channelOutput[i] = 0;
        }
      }
    } else {
      // Copy samples from buffer to output
      const numChannels = Math.min(output.length, this.channelData.length);

      for (let ch = 0; ch < numChannels; ch++) {
        const channelOutput = output[ch];
        const channelBuffer = this.channelData[ch];
        const bufferLength = channelBuffer.length;

        for (let i = 0; i < outputLength; i++) {
          let sampleIndex = this.playhead + i;

          // Handle loop wrapping
          if (this.loopEnabled && this.loopEnd > this.loopStart) {
            if (sampleIndex >= this.loopEnd) {
              sampleIndex = this.loopStart + ((sampleIndex - this.loopStart) % (this.loopEnd - this.loopStart));
            }
          }

          // Output sample or silence if past end
          if (sampleIndex >= 0 && sampleIndex < bufferLength) {
            channelOutput[i] = channelBuffer[sampleIndex];
          } else {
            channelOutput[i] = 0;
          }
        }
      }

      // Fill remaining output channels with silence if buffer has fewer channels
      for (let ch = numChannels; ch < output.length; ch++) {
        const channelOutput = output[ch];
        for (let i = 0; i < outputLength; i++) {
          channelOutput[i] = 0;
        }
      }

      // Advance playhead
      this.playhead += outputLength;

      // Handle loop
      if (this.loopEnabled && this.loopEnd > this.loopStart) {
        if (this.playhead >= this.loopEnd) {
          this.playhead = this.loopStart + ((this.playhead - this.loopStart) % (this.loopEnd - this.loopStart));
        }
      }

      // Handle end of track
      if (!this.loopEnabled && this.playhead >= this.bufferDuration) {
        this.isPlaying = false;
        this.playhead = this.bufferDuration;
        this.port.postMessage({ type: 'PLAYBACK_ENDED' });
      }
    }

    // Update SharedArrayBuffer for UI sync (atomic, fast)
    if (this.playheadWriter) {
      this.playheadWriter.update(
        this.playhead,
        this.bufferSampleRate,
        this.bufferDuration,
        this.isPlaying
      );
      // Debug: Log every ~1 second (344 frames at 44.1kHz/128 samples)
      if (!this._debugCounter) this._debugCounter = 0;
      this._debugCounter++;
      if (this._debugCounter % 344 === 0) {
        console.log('[DeckEngineProcessor] Writing to SAB:', {
          playhead: this.playhead,
          duration: this.bufferDuration,
          isPlaying: this.isPlaying,
          sampleRate: this.bufferSampleRate,
        });
      }
    }

    // Return true to keep processor alive
    return true;
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(event) {
    const { type, payload } = event.data;

    switch (type) {
      case 'SET_SAB': {
        if (payload) {
          this.playheadWriter = new PlayheadWriter(payload);
        }
        break;
      }

      case 'LOAD_BUFFER': {
        this.loadBuffer(payload);
        break;
      }

      case 'PLAY':
        if (this.bufferLoaded) {
          this.isPlaying = true;
          this.port.postMessage({ type: 'STATE_CHANGED', payload: { isPlaying: true } });
        }
        break;

      case 'PAUSE':
        this.isPlaying = false;
        this.port.postMessage({ type: 'STATE_CHANGED', payload: { isPlaying: false } });
        break;

      case 'STOP':
        this.isPlaying = false;
        this.playhead = 0;
        this.port.postMessage({ type: 'STATE_CHANGED', payload: { isPlaying: false, position: 0 } });
        break;

      case 'SEEK': {
        if (typeof payload === 'number' && !isNaN(payload)) {
          this.playhead = Math.max(0, Math.min(payload, this.bufferDuration));
          this.port.postMessage({ type: 'POSITION_CHANGED', payload: { position: this.playhead } });
        }
        break;
      }

      case 'SET_CUE': {
        if (typeof payload === 'number' && !isNaN(payload)) {
          this.cuePoint = Math.max(0, Math.min(payload, this.bufferDuration));
          this.port.postMessage({ type: 'CUE_SET', payload: { position: this.cuePoint } });
        }
        break;
      }

      case 'JUMP_TO_CUE':
        this.playhead = this.cuePoint;
        this.port.postMessage({ type: 'POSITION_CHANGED', payload: { position: this.playhead } });
        break;

      case 'SET_LOOP': {
        if (payload && typeof payload.start === 'number' && typeof payload.end === 'number') {
          this.loopStart = Math.max(0, payload.start);
          this.loopEnd = Math.min(this.bufferDuration, payload.end);
          this.loopEnabled = this.loopEnd > this.loopStart;
          this.port.postMessage({
            type: 'LOOP_CHANGED',
            payload: { enabled: this.loopEnabled, start: this.loopStart, end: this.loopEnd },
          });
        }
        break;
      }

      case 'CLEAR_LOOP':
        this.loopEnabled = false;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.port.postMessage({ type: 'LOOP_CHANGED', payload: { enabled: false } });
        break;

      default:
        // Silently ignore unknown message types to avoid string allocation
    }
  }

  /**
   * Load audio buffer from main thread
   */
  loadBuffer(data) {
    const { channelData, sampleRate, duration } = data;

    // Store buffer data (already Float32Arrays, no allocation needed)
    this.channelData = channelData;
    this.bufferSampleRate = sampleRate;
    this.bufferDuration = duration;
    this.bufferLoaded = true;

    // Reset playback state
    this.playhead = 0;
    this.isPlaying = false;
    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    // Notify main thread
    this.port.postMessage({
      type: 'BUFFER_LOADED',
      payload: {
        duration: this.bufferDuration,
        sampleRate: this.bufferSampleRate,
        channels: this.channelData.length,
      },
    });
  }
}

// Register the processor - this is required for AudioWorklet
registerProcessor('deck-engine', DeckEngineProcessor);
