/**
 * TimeStretchProcessor - Core Rubberband WASM wrapper for time-stretching
 *
 * Provides real-time time-stretching and pitch-shifting using Rubberband.
 * This class wraps the low-level Rubberband WASM interface with a cleaner API.
 *
 * Usage:
 * ```typescript
 * const processor = new TimeStretchProcessor(44100, 2);
 * await processor.initialize();
 *
 * processor.setTimeRatio(0.9);  // 10% faster
 * processor.setSemitones(2);    // +2 semitones
 *
 * // In audio processing loop:
 * const samplesOut = processor.process(inputBuffers, outputBuffers);
 * ```
 */

import type { RubberBandInterface, RubberBandState } from 'rubberband-wasm';
import { RubberbandLoader, RubberBandOption } from './rubberband-loader';

/** Minimum time ratio (2x faster) */
const MIN_TIME_RATIO = 0.5;

/** Maximum time ratio (2x slower) */
const MAX_TIME_RATIO = 2.0;

/** Minimum pitch scale (one octave down) */
const MIN_PITCH_SCALE = 0.5;

/** Maximum pitch scale (one octave up) */
const MAX_PITCH_SCALE = 2.0;

/** Minimum semitones */
const MIN_SEMITONES = -12;

/** Maximum semitones */
const MAX_SEMITONES = 12;

/** Default block size for processing */
const DEFAULT_BLOCK_SIZE = 512;

/**
 * TimeStretchProcessor - Wraps Rubberband for real-time time-stretching
 */
export class TimeStretchProcessor {
  private rubberband: RubberBandInterface | null = null;
  private state: RubberBandState = 0;
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly blockSize: number;

  // Pre-allocated WASM memory pointers
  private inputPtrs: number[] = [];
  private outputPtrs: number[] = [];
  private inputPtrArrayPtr = 0;
  private outputPtrArrayPtr = 0;

  // Track current values for getters when rubberband not available
  private currentTimeRatio = 1.0;
  private currentPitchScale = 1.0;

  private disposed = false;

  /**
   * Create a TimeStretchProcessor
   *
   * @param sampleRate - Sample rate in Hz (e.g., 44100)
   * @param channels - Number of audio channels (1 or 2)
   * @param blockSize - Processing block size (default 512)
   */
  constructor(sampleRate: number, channels: number, blockSize: number = DEFAULT_BLOCK_SIZE) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.blockSize = blockSize;
  }

  /**
   * Initialize the processor - must be called before use
   *
   * Loads the Rubberband WASM module and creates a stretcher instance.
   */
  async initialize(): Promise<void> {
    // Load Rubberband WASM
    this.rubberband = await RubberbandLoader.initialize();

    // Configure options for real-time processing:
    // - ProcessRealTime: No study pass, immediate processing
    // - EngineFaster: R2 engine with lower latency
    // - PitchHighConsistency: Stable pitch during ratio changes
    // - ChannelsTogether: Process channels together for better stereo
    const options =
      RubberBandOption.RubberBandOptionProcessRealTime |
      RubberBandOption.RubberBandOptionEngineFaster |
      RubberBandOption.RubberBandOptionPitchHighConsistency |
      RubberBandOption.RubberBandOptionChannelsTogether;

    // Create Rubberband state
    this.state = this.rubberband.rubberband_new(
      this.sampleRate,
      this.channels,
      options,
      1.0, // initialTimeRatio
      1.0 // initialPitchScale
    );

    // Set max process size for consistent block processing
    this.rubberband.rubberband_set_max_process_size(this.state, this.blockSize);

    // Pre-allocate WASM memory for input/output buffers
    this.allocateBuffers();
  }

  /**
   * Check if the processor is initialized
   */
  isInitialized(): boolean {
    return this.rubberband !== null && this.state !== 0 && !this.disposed;
  }

  /**
   * Get the sample rate
   */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * Get the number of channels
   */
  getChannels(): number {
    return this.channels;
  }

  /**
   * Set the time ratio (tempo change without pitch change)
   *
   * @param ratio - Time ratio (0.5 = 2x faster, 2.0 = 2x slower)
   */
  setTimeRatio(ratio: number): void {
    if (!this.isInitialized()) return;

    const clamped = Math.max(MIN_TIME_RATIO, Math.min(MAX_TIME_RATIO, ratio));
    this.currentTimeRatio = clamped;
    this.rubberband!.rubberband_set_time_ratio(this.state, clamped);
  }

  /**
   * Get the current time ratio
   */
  getTimeRatio(): number {
    if (!this.isInitialized()) return this.currentTimeRatio;
    return this.rubberband!.rubberband_get_time_ratio(this.state);
  }

  /**
   * Set the pitch scale (pitch change without tempo change)
   *
   * @param scale - Pitch scale (0.5 = octave down, 2.0 = octave up)
   */
  setPitchScale(scale: number): void {
    if (!this.isInitialized()) return;

    const clamped = Math.max(MIN_PITCH_SCALE, Math.min(MAX_PITCH_SCALE, scale));
    this.currentPitchScale = clamped;
    this.rubberband!.rubberband_set_pitch_scale(this.state, clamped);
  }

  /**
   * Get the current pitch scale
   */
  getPitchScale(): number {
    if (!this.isInitialized()) return this.currentPitchScale;
    return this.rubberband!.rubberband_get_pitch_scale(this.state);
  }

  /**
   * Set the pitch in semitones (convenience method)
   *
   * @param semitones - Pitch shift in semitones (-12 to +12)
   */
  setSemitones(semitones: number): void {
    const clamped = Math.max(MIN_SEMITONES, Math.min(MAX_SEMITONES, semitones));
    const scale = Math.pow(2.0, clamped / 12.0);
    this.setPitchScale(scale);
  }

  /**
   * Get the current pitch in semitones
   */
  getSemitones(): number {
    const scale = this.getPitchScale();
    return Math.round(12.0 * Math.log2(scale));
  }

  /**
   * Get the processing start delay in samples
   *
   * This is the number of samples of latency introduced by the processor.
   */
  getStartDelay(): number {
    if (!this.isInitialized()) return 0;
    return this.rubberband!.rubberband_get_start_delay(this.state);
  }

  /**
   * Get the latency in samples
   */
  getLatency(): number {
    if (!this.isInitialized()) return 0;
    return this.rubberband!.rubberband_get_latency(this.state);
  }

  /**
   * Process audio through the time-stretcher
   *
   * @param input - Array of Float32Arrays, one per channel
   * @param output - Array of Float32Arrays to receive output, one per channel
   * @param isFinal - Whether this is the final block of audio
   * @returns Number of samples written to output buffers
   */
  process(input: Float32Array[], output: Float32Array[], isFinal = false): number {
    if (!this.isInitialized()) return 0;

    const rb = this.rubberband!;
    const samples = input[0].length;

    // Copy input data to WASM memory
    for (let ch = 0; ch < this.channels; ch++) {
      if (input[ch] && this.inputPtrs[ch]) {
        rb.memWrite(this.inputPtrs[ch], input[ch]);
      }
    }

    // Process the input
    rb.rubberband_process(this.state, this.inputPtrArrayPtr, samples, isFinal ? 1 : 0);

    // Check how many samples are available
    const available = rb.rubberband_available(this.state);
    if (available <= 0) return 0;

    // Retrieve output (limited by output buffer size)
    const maxOutput = output[0].length;
    const toRetrieve = Math.min(available, maxOutput);

    const retrieved = rb.rubberband_retrieve(this.state, this.outputPtrArrayPtr, toRetrieve);

    // Copy output from WASM memory
    for (let ch = 0; ch < this.channels; ch++) {
      if (output[ch] && this.outputPtrs[ch]) {
        const wasmOutput = rb.memReadF32(this.outputPtrs[ch], retrieved);
        output[ch].set(wasmOutput.subarray(0, Math.min(retrieved, output[ch].length)));
      }
    }

    return retrieved;
  }

  /**
   * Reset the processor state
   *
   * Call this when seeking or switching tracks.
   */
  reset(): void {
    if (!this.isInitialized()) return;
    this.rubberband!.rubberband_reset(this.state);
  }

  /**
   * Dispose of the processor and free resources
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.rubberband && this.state) {
      // Free the Rubberband state
      this.rubberband.rubberband_delete(this.state);

      // Free allocated memory
      this.freeBuffers();
    }

    this.rubberband = null;
    this.state = 0;
  }

  /**
   * Allocate WASM memory for input/output buffers
   */
  private allocateBuffers(): void {
    if (!this.rubberband) return;

    const rb = this.rubberband;

    // Allocate per-channel buffers (Float32 = 4 bytes per sample)
    const bufferSize = this.blockSize * 4 * 4; // 4x for potential expansion

    for (let ch = 0; ch < this.channels; ch++) {
      this.inputPtrs[ch] = rb.malloc(bufferSize);
      this.outputPtrs[ch] = rb.malloc(bufferSize);
    }

    // Allocate pointer arrays (pointer = 4 bytes)
    this.inputPtrArrayPtr = rb.malloc(this.channels * 4);
    this.outputPtrArrayPtr = rb.malloc(this.channels * 4);

    // Write channel pointers to pointer arrays
    for (let ch = 0; ch < this.channels; ch++) {
      rb.memWritePtr(this.inputPtrArrayPtr + ch * 4, this.inputPtrs[ch]);
      rb.memWritePtr(this.outputPtrArrayPtr + ch * 4, this.outputPtrs[ch]);
    }
  }

  /**
   * Free WASM memory for input/output buffers
   */
  private freeBuffers(): void {
    if (!this.rubberband) return;

    const rb = this.rubberband;

    // Free per-channel buffers
    for (const ptr of this.inputPtrs) {
      if (ptr) rb.free(ptr);
    }
    for (const ptr of this.outputPtrs) {
      if (ptr) rb.free(ptr);
    }

    // Free pointer arrays
    if (this.inputPtrArrayPtr) rb.free(this.inputPtrArrayPtr);
    if (this.outputPtrArrayPtr) rb.free(this.outputPtrArrayPtr);

    this.inputPtrs = [];
    this.outputPtrs = [];
    this.inputPtrArrayPtr = 0;
    this.outputPtrArrayPtr = 0;
  }
}
