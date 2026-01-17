/**
 * TimeStretchNode - Web Audio API node wrapper for time-stretching
 *
 * Provides a Web Audio compatible interface for the TimeStretchProcessor.
 * Can be inserted into an audio graph and controlled via standard methods.
 *
 * Features:
 * - Keylock mode (enable/disable time-stretching)
 * - Bypass mode when keylock is disabled
 * - Time ratio and pitch scale control
 * - Seamless audio processing
 *
 * Usage:
 * ```typescript
 * const node = new TimeStretchNode(audioContext);
 * await node.initialize();
 *
 * // Connect into audio graph
 * sourceNode.connect(node.input);
 * node.connect(audioContext.destination);
 *
 * // Control
 * node.setKeylockEnabled(true);
 * node.setTimeRatio(0.9);  // 10% faster
 * node.setSemitones(2);    // +2 semitones
 * ```
 */

import { TimeStretchProcessor } from './time-stretch-processor';

/** Minimum time ratio */
const MIN_TIME_RATIO = 0.5;

/** Maximum time ratio */
const MAX_TIME_RATIO = 2.0;

/** Minimum semitones */
const MIN_SEMITONES = -12;

/** Maximum semitones */
const MAX_SEMITONES = 12;

/** Buffer size for ScriptProcessorNode (must be power of 2) */
const BUFFER_SIZE = 512;

/**
 * TimeStretchNode - Audio node wrapper for Rubberband time-stretching
 */
export class TimeStretchNode {
  private readonly audioContext: AudioContext;
  private processor: TimeStretchProcessor | null = null;

  // Audio nodes
  private inputGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private bypassGain: GainNode | null = null;

  // State
  private _keylockEnabled = false;
  private _timeRatio = 1.0;
  private _pitchScale = 1.0;
  private _semitones = 0;
  private _initialized = false;
  private _disposed = false;

  // Processing buffers (pre-allocated to avoid GC)
  private inputBuffers: Float32Array[] = [];
  private outputBuffers: Float32Array[] = [];

  /**
   * Create a TimeStretchNode
   *
   * @param audioContext - The AudioContext to use
   */
  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Initialize the node - must be called before use
   */
  async initialize(): Promise<void> {
    if (this._initialized || this._disposed) return;

    const sampleRate = this.audioContext.sampleRate;
    const channels = 2; // Stereo

    // Create TimeStretchProcessor
    this.processor = new TimeStretchProcessor(sampleRate, channels, BUFFER_SIZE);
    await this.processor.initialize();

    // Create audio nodes
    this.inputGain = this.audioContext.createGain();
    this.outputGain = this.audioContext.createGain();
    this.bypassGain = this.audioContext.createGain();

    // Create script processor for audio processing
    // Note: ScriptProcessorNode is deprecated but still widely supported
    // Future: Migrate to AudioWorkletNode for better performance
    this.scriptProcessor = this.audioContext.createScriptProcessor(BUFFER_SIZE, channels, channels);

    // Pre-allocate processing buffers
    this.inputBuffers = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
    this.outputBuffers = [
      new Float32Array(BUFFER_SIZE * 4),
      new Float32Array(BUFFER_SIZE * 4),
    ];

    // Set up audio processing
    this.scriptProcessor.onaudioprocess = this.handleAudioProcess.bind(this);

    // Wire up nodes:
    // Input → [ScriptProcessor OR Bypass] → Output
    this.inputGain.connect(this.scriptProcessor);
    this.inputGain.connect(this.bypassGain);
    this.scriptProcessor.connect(this.outputGain);
    this.bypassGain.connect(this.outputGain);

    // Start in bypass mode (keylock disabled)
    this.updateBypassState();

    this._initialized = true;
  }

  /**
   * Check if the node is initialized
   */
  isInitialized(): boolean {
    return this._initialized && !this._disposed;
  }

  /**
   * Get the input node for connecting audio sources
   */
  get input(): AudioNode {
    if (!this.inputGain) {
      throw new Error('TimeStretchNode not initialized');
    }
    return this.inputGain;
  }

  /**
   * Get the output node for connecting to destinations
   */
  get output(): AudioNode {
    if (!this.outputGain) {
      throw new Error('TimeStretchNode not initialized');
    }
    return this.outputGain;
  }

  /**
   * Connect the output to a destination
   */
  connect(destination: AudioNode): void {
    if (this.outputGain) {
      this.outputGain.connect(destination);
    }
  }

  /**
   * Disconnect from a destination
   */
  disconnect(destination?: AudioNode): void {
    if (this.outputGain) {
      if (destination) {
        this.outputGain.disconnect(destination);
      } else {
        this.outputGain.disconnect();
      }
    }
  }

  // ============ Keylock Control ============

  /**
   * Enable or disable keylock (time-stretching)
   */
  setKeylockEnabled(enabled: boolean): void {
    this._keylockEnabled = enabled;
    this.updateBypassState();
  }

  /**
   * Check if keylock is enabled
   */
  isKeylockEnabled(): boolean {
    return this._keylockEnabled;
  }

  /**
   * Check if processing is bypassed
   */
  isBypassed(): boolean {
    return !this._keylockEnabled;
  }

  // ============ Time Ratio Control ============

  /**
   * Set the time ratio (tempo change)
   *
   * @param ratio - Time ratio (0.5 = 2x faster, 2.0 = 2x slower)
   */
  setTimeRatio(ratio: number): void {
    this._timeRatio = Math.max(MIN_TIME_RATIO, Math.min(MAX_TIME_RATIO, ratio));
    if (this.processor) {
      this.processor.setTimeRatio(this._timeRatio);
    }
  }

  /**
   * Get the current time ratio
   */
  getTimeRatio(): number {
    return this._timeRatio;
  }

  // ============ Pitch Control ============

  /**
   * Set the pitch scale
   *
   * @param scale - Pitch scale (0.5 = octave down, 2.0 = octave up)
   */
  setPitchScale(scale: number): void {
    this._pitchScale = Math.max(0.5, Math.min(2.0, scale));
    this._semitones = Math.round(12 * Math.log2(this._pitchScale));
    if (this.processor) {
      this.processor.setPitchScale(this._pitchScale);
    }
  }

  /**
   * Get the current pitch scale
   */
  getPitchScale(): number {
    return this._pitchScale;
  }

  /**
   * Set the pitch in semitones
   *
   * @param semitones - Pitch shift in semitones (-12 to +12)
   */
  setSemitones(semitones: number): void {
    this._semitones = Math.max(MIN_SEMITONES, Math.min(MAX_SEMITONES, semitones));
    this._pitchScale = Math.pow(2, this._semitones / 12);
    if (this.processor) {
      this.processor.setSemitones(this._semitones);
    }
  }

  /**
   * Get the current pitch in semitones
   */
  getSemitones(): number {
    return this._semitones;
  }

  // ============ Latency ============

  /**
   * Get the processing latency in samples
   */
  getLatency(): number {
    return this.processor?.getLatency() ?? 0;
  }

  /**
   * Get the start delay in samples
   */
  getStartDelay(): number {
    return this.processor?.getStartDelay() ?? 0;
  }

  // ============ Reset & Dispose ============

  /**
   * Reset the processor state
   */
  reset(): void {
    if (this.processor) {
      this.processor.reset();
    }
  }

  /**
   * Dispose of the node and free resources
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._initialized = false;

    // Disconnect nodes
    if (this.inputGain) {
      this.inputGain.disconnect();
      this.inputGain = null;
    }
    if (this.outputGain) {
      this.outputGain.disconnect();
      this.outputGain = null;
    }
    if (this.bypassGain) {
      this.bypassGain.disconnect();
      this.bypassGain = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    // Dispose processor
    if (this.processor) {
      this.processor.dispose();
      this.processor = null;
    }

    // Clear buffers
    this.inputBuffers = [];
    this.outputBuffers = [];
  }

  // ============ Private Methods ============

  /**
   * Update bypass state based on keylock setting
   */
  private updateBypassState(): void {
    if (!this.scriptProcessor || !this.bypassGain) return;

    if (this._keylockEnabled) {
      // Active processing: enable script processor, disable bypass
      this.scriptProcessor.connect(this.outputGain!);
      this.bypassGain.gain.value = 0;
    } else {
      // Bypass: disable script processor, enable bypass
      this.scriptProcessor.disconnect();
      this.bypassGain.gain.value = 1;
    }
  }

  /**
   * Handle audio processing (called by ScriptProcessorNode)
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.processor || !this._keylockEnabled || this._disposed) {
      // Pass through silently or let bypass handle it
      return;
    }

    const inputBuffer = event.inputBuffer;
    const outputBuffer = event.outputBuffer;
    const numSamples = inputBuffer.length;

    // Copy input to processing buffers
    for (let ch = 0; ch < inputBuffer.numberOfChannels; ch++) {
      const inputData = inputBuffer.getChannelData(ch);
      if (this.inputBuffers[ch]) {
        this.inputBuffers[ch].set(inputData);
      }
    }

    // Process through Rubberband
    const samplesOut = this.processor.process(this.inputBuffers, this.outputBuffers);

    // Copy output (if we got samples)
    if (samplesOut > 0) {
      for (let ch = 0; ch < outputBuffer.numberOfChannels; ch++) {
        const outputData = outputBuffer.getChannelData(ch);
        const processedData = this.outputBuffers[ch];
        if (processedData) {
          // Copy what we have, zero-pad if needed
          const toCopy = Math.min(samplesOut, numSamples);
          outputData.set(processedData.subarray(0, toCopy));
          // Zero remaining samples if any
          if (toCopy < numSamples) {
            outputData.fill(0, toCopy);
          }
        }
      }
    } else {
      // No output available, output silence
      for (let ch = 0; ch < outputBuffer.numberOfChannels; ch++) {
        outputBuffer.getChannelData(ch).fill(0);
      }
    }
  }
}
