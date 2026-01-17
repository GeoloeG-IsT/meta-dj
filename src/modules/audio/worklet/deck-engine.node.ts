/**
 * DeckEngineNode - AudioWorkletNode wrapper for deck playback
 *
 * Provides a clean TypeScript API for the DeckEngineProcessor.
 * Handles:
 * - Worklet module loading
 * - Buffer loading with sample rate conversion
 * - Transport controls (play, pause, stop, seek)
 * - Cue point management
 * - Loop control
 * - SharedArrayBuffer setup for playhead sync
 */

import { createPlayheadSAB, PlayheadReader } from '../hooks/usePlayheadSync';

/** Message types sent to the processor */
export type ProcessorCommandType =
  | 'LOAD_BUFFER'
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'SEEK'
  | 'SET_CUE'
  | 'JUMP_TO_CUE'
  | 'SET_LOOP'
  | 'CLEAR_LOOP'
  | 'SET_SAB'
  | 'SET_TIME_RATIO'
  | 'SET_PITCH_SCALE'
  | 'SET_KEYLOCK';

/** Message types received from the processor */
export type ProcessorEventType =
  | 'READY'
  | 'BUFFER_LOADED'
  | 'STATE_CHANGED'
  | 'POSITION_CHANGED'
  | 'CUE_SET'
  | 'LOOP_CHANGED'
  | 'PLAYBACK_ENDED'
  | 'TIME_RATIO_CHANGED'
  | 'PITCH_SCALE_CHANGED'
  | 'KEYLOCK_CHANGED';

/** Event payload for state changes */
export interface StateChangedPayload {
  isPlaying: boolean;
  position?: number;
}

/** Event payload for buffer loaded */
export interface BufferLoadedPayload {
  duration: number;
  sampleRate: number;
  channels: number;
}

/** Event payload for loop changes */
export interface LoopChangedPayload {
  enabled: boolean;
  start?: number;
  end?: number;
}

/** Event payload for time ratio changes */
export interface TimeRatioChangedPayload {
  timeRatio: number;
}

/** Event payload for pitch scale changes */
export interface PitchScaleChangedPayload {
  pitchScale: number;
}

/** Event payload for keylock changes */
export interface KeylockChangedPayload {
  keylockEnabled: boolean;
}

/** Events emitted by DeckEngineNode */
export interface DeckEngineEvents {
  ready: () => void;
  bufferLoaded: (payload: BufferLoadedPayload) => void;
  stateChanged: (payload: StateChangedPayload) => void;
  positionChanged: (position: number) => void;
  cueSet: (position: number) => void;
  loopChanged: (payload: LoopChangedPayload) => void;
  playbackEnded: () => void;
  timeRatioChanged: (payload: TimeRatioChangedPayload) => void;
  pitchScaleChanged: (payload: PitchScaleChangedPayload) => void;
  keylockChanged: (payload: KeylockChangedPayload) => void;
}

/**
 * DeckEngineNode - Main thread wrapper for the AudioWorklet processor
 *
 * Usage:
 * ```typescript
 * // Initialize once
 * await DeckEngineNode.loadModule(audioContext);
 *
 * // Create instance
 * const deckEngine = new DeckEngineNode(audioContext);
 * deckEngine.connect(audioContext.destination);
 *
 * // Load and play
 * await deckEngine.loadBuffer(audioBuffer);
 * deckEngine.play();
 * ```
 */
export class DeckEngineNode extends AudioWorkletNode {
  private static moduleLoaded = false;

  // Playhead sync
  private _sharedArrayBuffer: SharedArrayBuffer | null = null;
  private _playheadReader: PlayheadReader | null = null;

  // State tracking
  private _isReady = false;
  private _isPlaying = false;
  private _duration = 0;
  private _sampleRate = 44100;
  private _cuePoint = 0;
  private _loopEnabled = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  // Time-stretch state
  private _timeRatio = 1.0;
  private _pitchScale = 1.0;
  private _keylockEnabled = false;

  // Event callbacks
  private eventHandlers: Partial<DeckEngineEvents> = {};

  /**
   * Load the AudioWorklet module. Must be called once before creating instances.
   * @param audioContext - The AudioContext to load the module into
   */
  static async loadModule(audioContext: AudioContext): Promise<void> {
    if (DeckEngineNode.moduleLoaded) {
      return;
    }

    try {
      await audioContext.audioWorklet.addModule('/deck-engine.processor.js');
      DeckEngineNode.moduleLoaded = true;
    } catch (error) {
      console.error('[DeckEngineNode] Failed to load AudioWorklet module:', error);
      throw new Error('Failed to load DeckEngineProcessor module');
    }
  }

  /**
   * Check if the AudioWorklet module has been loaded
   */
  static isModuleLoaded(): boolean {
    return DeckEngineNode.moduleLoaded;
  }

  /**
   * Create a new DeckEngineNode
   * @param audioContext - The AudioContext to use
   * @param useSharedArrayBuffer - Whether to use SAB for playhead sync (default: true)
   */
  constructor(audioContext: AudioContext, useSharedArrayBuffer = true) {
    // Initialize SharedArrayBuffer if supported and requested
    let sab: SharedArrayBuffer | undefined;
    if (useSharedArrayBuffer) {
      try {
        sab = createPlayheadSAB();
      } catch (e) {
        console.warn('[DeckEngineNode] SharedArrayBuffer not available, using postMessage fallback');
      }
    }

    // Create the AudioWorkletNode with processor options
    super(audioContext, 'deck-engine', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2], // Stereo output
      processorOptions: {
        sharedArrayBuffer: sab,
      },
    });

    // Store SAB and create reader
    if (sab) {
      this._sharedArrayBuffer = sab;
      this._playheadReader = new PlayheadReader(sab);
    }

    // Set up message handler for events from processor
    this.port.onmessage = this.handleProcessorMessage.bind(this);
  }

  /**
   * Get the SharedArrayBuffer for external use (e.g., with usePlayheadSync hook)
   */
  get sharedArrayBuffer(): SharedArrayBuffer | null {
    return this._sharedArrayBuffer;
  }

  /**
   * Get the PlayheadReader for direct position access
   */
  get playheadReader(): PlayheadReader | null {
    return this._playheadReader;
  }

  /**
   * Check if the processor is ready
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Check if audio is currently playing
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Get the current playhead position in samples
   */
  get position(): number {
    if (this._playheadReader) {
      return this._playheadReader.getPosition();
    }
    return 0;
  }

  /**
   * Get the current playhead position in seconds
   */
  get positionInSeconds(): number {
    if (this._playheadReader) {
      return this._playheadReader.getPositionInSeconds();
    }
    return 0;
  }

  /**
   * Get the normalized playhead position (0-1)
   */
  get normalizedPosition(): number {
    if (this._playheadReader) {
      return this._playheadReader.getNormalizedPosition();
    }
    return 0;
  }

  /**
   * Get the buffer duration in samples
   */
  get duration(): number {
    return this._duration;
  }

  /**
   * Get the buffer duration in seconds
   */
  get durationInSeconds(): number {
    if (this._sampleRate <= 0) return 0;
    return this._duration / this._sampleRate;
  }

  /**
   * Get the buffer sample rate
   */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /**
   * Get the current cue point position in samples
   */
  get cuePoint(): number {
    return this._cuePoint;
  }

  /**
   * Check if loop is enabled
   */
  get loopEnabled(): boolean {
    return this._loopEnabled;
  }

  /**
   * Get loop start position in samples
   */
  get loopStart(): number {
    return this._loopStart;
  }

  /**
   * Get loop end position in samples
   */
  get loopEnd(): number {
    return this._loopEnd;
  }

  // ============ Time-Stretch State Getters ============

  /**
   * Get the current time ratio
   * (0.5 = 2x faster, 1.0 = normal, 2.0 = 2x slower)
   */
  get timeRatio(): number {
    return this._timeRatio;
  }

  /**
   * Get the current pitch scale
   * (0.5 = octave down, 1.0 = normal, 2.0 = octave up)
   */
  get pitchScale(): number {
    return this._pitchScale;
  }

  /**
   * Check if keylock is enabled
   */
  get keylockEnabled(): boolean {
    return this._keylockEnabled;
  }

  /**
   * Load an AudioBuffer into the processor
   * @param audioBuffer - The AudioBuffer to load
   */
  async loadBuffer(audioBuffer: AudioBuffer): Promise<void> {
    // Extract channel data as transferable Float32Arrays
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      // Create a copy since getChannelData returns a view
      const data = audioBuffer.getChannelData(ch);
      channelData.push(new Float32Array(data));
    }

    // Calculate duration in samples
    const duration = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    // Send buffer to processor with transferable arrays
    this.port.postMessage(
      {
        type: 'LOAD_BUFFER',
        payload: {
          channelData,
          sampleRate,
          duration,
        },
      },
      channelData.map((arr) => arr.buffer)
    );

    // Wait for confirmation with timeout
    return new Promise((resolve, reject) => {
      const LOAD_TIMEOUT_MS = 10000; // 10 second timeout

      const timeoutId = setTimeout(() => {
        this.port.removeEventListener('message', handler);
        reject(new Error('Buffer load timeout - processor did not respond'));
      }, LOAD_TIMEOUT_MS);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'BUFFER_LOADED') {
          clearTimeout(timeoutId);
          this.port.removeEventListener('message', handler);
          resolve();
        }
      };
      this.port.addEventListener('message', handler);
    });
  }

  /**
   * Start playback
   */
  play(): void {
    this.port.postMessage({ type: 'PLAY' });
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.port.postMessage({ type: 'PAUSE' });
  }

  /**
   * Stop playback and reset position to start
   */
  stop(): void {
    this.port.postMessage({ type: 'STOP' });
  }

  /**
   * Seek to a position in samples
   * @param positionSamples - Position in samples
   */
  seek(positionSamples: number): void {
    this.port.postMessage({ type: 'SEEK', payload: positionSamples });
  }

  /**
   * Seek to a position in seconds
   * @param positionSeconds - Position in seconds
   */
  seekToSeconds(positionSeconds: number): void {
    const positionSamples = Math.floor(positionSeconds * this._sampleRate);
    this.seek(positionSamples);
  }

  /**
   * Seek to a normalized position (0-1)
   * @param normalizedPosition - Position as fraction of duration
   */
  seekToNormalized(normalizedPosition: number): void {
    const positionSamples = Math.floor(normalizedPosition * this._duration);
    this.seek(positionSamples);
  }

  /**
   * Set the cue point
   * @param positionSamples - Cue position in samples
   */
  setCuePoint(positionSamples: number): void {
    this.port.postMessage({ type: 'SET_CUE', payload: positionSamples });
  }

  /**
   * Set the cue point to the current playhead position
   */
  setCuePointAtCurrent(): void {
    this.setCuePoint(this.position);
  }

  /**
   * Jump to the cue point
   */
  jumpToCue(): void {
    this.port.postMessage({ type: 'JUMP_TO_CUE' });
  }

  /**
   * Set a loop region
   * @param startSamples - Loop start in samples
   * @param endSamples - Loop end in samples
   */
  setLoop(startSamples: number, endSamples: number): void {
    this.port.postMessage({
      type: 'SET_LOOP',
      payload: { start: startSamples, end: endSamples },
    });
  }

  /**
   * Set a loop region in seconds
   * @param startSeconds - Loop start in seconds
   * @param endSeconds - Loop end in seconds
   */
  setLoopSeconds(startSeconds: number, endSeconds: number): void {
    this.setLoop(
      Math.floor(startSeconds * this._sampleRate),
      Math.floor(endSeconds * this._sampleRate)
    );
  }

  /**
   * Clear the loop region
   */
  clearLoop(): void {
    this.port.postMessage({ type: 'CLEAR_LOOP' });
  }

  // ============ Time-Stretch Controls ============

  /**
   * Set the time ratio (tempo change)
   * Note: This tracks state for the processor. Actual time-stretching
   * is handled by TimeStretchNode in the audio graph.
   *
   * @param ratio - Time ratio (0.5 = 2x faster, 2.0 = 2x slower)
   */
  setTimeRatio(ratio: number): void {
    this.port.postMessage({ type: 'SET_TIME_RATIO', payload: ratio });
  }

  /**
   * Set the pitch scale
   * Note: This tracks state for the processor. Actual pitch-shifting
   * is handled by TimeStretchNode in the audio graph.
   *
   * @param scale - Pitch scale (0.5 = octave down, 2.0 = octave up)
   */
  setPitchScale(scale: number): void {
    this.port.postMessage({ type: 'SET_PITCH_SCALE', payload: scale });
  }

  /**
   * Set the pitch in semitones (convenience method)
   *
   * @param semitones - Pitch shift in semitones (-12 to +12)
   */
  setSemitones(semitones: number): void {
    const scale = Math.pow(2, semitones / 12);
    this.setPitchScale(scale);
  }

  /**
   * Enable or disable keylock
   *
   * @param enabled - Whether keylock should be enabled
   */
  setKeylockEnabled(enabled: boolean): void {
    this.port.postMessage({ type: 'SET_KEYLOCK', payload: enabled });
  }

  /**
   * Register an event handler
   * @param event - Event name
   * @param handler - Event handler function
   */
  on<K extends keyof DeckEngineEvents>(event: K, handler: DeckEngineEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Remove an event handler
   * @param event - Event name
   */
  off<K extends keyof DeckEngineEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disconnect();
    this.eventHandlers = {};
    this._sharedArrayBuffer = null;
    this._playheadReader = null;
  }

  /**
   * Handle messages from the processor
   */
  private handleProcessorMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'READY':
        this._isReady = true;
        this.eventHandlers.ready?.();
        break;

      case 'BUFFER_LOADED': {
        const data = payload as BufferLoadedPayload;
        this._duration = data.duration;
        this._sampleRate = data.sampleRate;
        this.eventHandlers.bufferLoaded?.(data);
        break;
      }

      case 'STATE_CHANGED': {
        const state = payload as StateChangedPayload;
        this._isPlaying = state.isPlaying;
        this.eventHandlers.stateChanged?.(state);
        break;
      }

      case 'POSITION_CHANGED': {
        const pos = payload as { position: number };
        this.eventHandlers.positionChanged?.(pos.position);
        break;
      }

      case 'CUE_SET': {
        const cue = payload as { position: number };
        this._cuePoint = cue.position;
        this.eventHandlers.cueSet?.(cue.position);
        break;
      }

      case 'LOOP_CHANGED': {
        const loop = payload as LoopChangedPayload;
        this._loopEnabled = loop.enabled;
        this._loopStart = loop.start ?? 0;
        this._loopEnd = loop.end ?? 0;
        this.eventHandlers.loopChanged?.(loop);
        break;
      }

      case 'PLAYBACK_ENDED':
        this._isPlaying = false;
        this.eventHandlers.playbackEnded?.();
        break;

      case 'TIME_RATIO_CHANGED': {
        const data = payload as TimeRatioChangedPayload;
        this._timeRatio = data.timeRatio;
        this.eventHandlers.timeRatioChanged?.(data);
        break;
      }

      case 'PITCH_SCALE_CHANGED': {
        const data = payload as PitchScaleChangedPayload;
        this._pitchScale = data.pitchScale;
        this.eventHandlers.pitchScaleChanged?.(data);
        break;
      }

      case 'KEYLOCK_CHANGED': {
        const data = payload as KeylockChangedPayload;
        this._keylockEnabled = data.keylockEnabled;
        this.eventHandlers.keylockChanged?.(data);
        break;
      }
    }
  }
}

/**
 * Resample an AudioBuffer to a target sample rate using OfflineAudioContext
 * This provides high-quality resampling for DJ applications
 *
 * @param audioBuffer - Source AudioBuffer
 * @param targetSampleRate - Target sample rate (e.g., AudioContext.sampleRate)
 * @returns Resampled AudioBuffer
 */
export async function resampleBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  // If already at target rate, return as-is
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer;
  }

  // Calculate new length
  const duration = audioBuffer.duration;
  const newLength = Math.ceil(duration * targetSampleRate);

  // Create offline context for resampling
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    newLength,
    targetSampleRate
  );

  // Create source and connect
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  // Render
  return await offlineCtx.startRendering();
}
