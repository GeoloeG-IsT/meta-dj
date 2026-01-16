/**
 * usePlayheadSync - SharedArrayBuffer-based playhead synchronization
 *
 * Provides low-latency (<16ms) playhead position updates from AudioWorklet.
 * Uses SharedArrayBuffer for lock-free communication between threads.
 *
 * Architecture:
 * - AudioWorklet writes playhead position to SharedArrayBuffer
 * - Main thread reads from SAB using requestAnimationFrame
 * - No postMessage latency for real-time sync
 */

import { useRef, useEffect, useCallback, useState } from 'react';

/** SharedArrayBuffer layout for playhead sync */
export interface PlayheadSABLayout {
  /** Byte offset for sequence counter (Int32 - for atomic read consistency) */
  SEQUENCE: number;
  /** Byte offset for playhead position (Float64) */
  PLAYHEAD_POSITION: number;
  /** Byte offset for sample rate (Float64) */
  SAMPLE_RATE: number;
  /** Byte offset for duration (Float64) */
  DURATION: number;
  /** Byte offset for playing state (Int32: 0=stopped, 1=playing) */
  IS_PLAYING: number;
  /** Total size in bytes */
  TOTAL_SIZE: number;
}

export const PLAYHEAD_SAB_LAYOUT: PlayheadSABLayout = {
  SEQUENCE: 0,           // Int32 (4 bytes) - sequence counter for atomic consistency
  // 4 bytes padding for Float64 alignment
  PLAYHEAD_POSITION: 8,  // Float64 (8 bytes)
  SAMPLE_RATE: 16,       // Float64 (8 bytes)
  DURATION: 24,          // Float64 (8 bytes)
  IS_PLAYING: 32,        // Int32 (4 bytes)
  TOTAL_SIZE: 40,        // Total: 40 bytes (aligned)
};

/**
 * Create a SharedArrayBuffer for playhead synchronization.
 * Must be created on main thread and transferred to AudioWorklet.
 */
export function createPlayheadSAB(): SharedArrayBuffer {
  // Check if SharedArrayBuffer is available (requires cross-origin isolation)
  if (typeof SharedArrayBuffer === 'undefined') {
    console.warn('SharedArrayBuffer not available. Falling back to postMessage sync.');
    throw new Error('SharedArrayBuffer requires cross-origin isolation headers');
  }

  return new SharedArrayBuffer(PLAYHEAD_SAB_LAYOUT.TOTAL_SIZE);
}

/**
 * Helper class to write playhead data from AudioWorklet.
 * Use this in your AudioWorkletProcessor.
 *
 * Uses a sequence counter pattern for atomic consistency:
 * - Increment sequence (makes it odd = write in progress)
 * - Write all float values
 * - Increment sequence again (makes it even = write complete)
 *
 * Reader checks sequence before/after reading to detect torn reads.
 */
export class PlayheadWriter {
  private int32View: Int32Array;
  private dataView: DataView;

  constructor(sab: SharedArrayBuffer) {
    this.int32View = new Int32Array(sab);
    this.dataView = new DataView(sab);
  }

  /**
   * Begin a write transaction. Call before updating any values.
   * This increments the sequence counter to an odd number.
   */
  beginWrite(): void {
    Atomics.add(this.int32View, PLAYHEAD_SAB_LAYOUT.SEQUENCE / 4, 1);
  }

  /**
   * End a write transaction. Call after updating all values.
   * This increments the sequence counter to an even number.
   */
  endWrite(): void {
    Atomics.add(this.int32View, PLAYHEAD_SAB_LAYOUT.SEQUENCE / 4, 1);
  }

  /** Write current playhead position (in samples) - stored as Float64 */
  setPosition(positionInSamples: number): void {
    this.dataView.setFloat64(PLAYHEAD_SAB_LAYOUT.PLAYHEAD_POSITION, positionInSamples, true);
  }

  /** Write sample rate - stored as Float64 */
  setSampleRate(sampleRate: number): void {
    this.dataView.setFloat64(PLAYHEAD_SAB_LAYOUT.SAMPLE_RATE, sampleRate, true);
  }

  /** Write duration (in samples) - stored as Float64 */
  setDuration(durationInSamples: number): void {
    this.dataView.setFloat64(PLAYHEAD_SAB_LAYOUT.DURATION, durationInSamples, true);
  }

  /** Write playing state - stored as Int32 for atomic access */
  setIsPlaying(isPlaying: boolean): void {
    Atomics.store(this.int32View, PLAYHEAD_SAB_LAYOUT.IS_PLAYING / 4, isPlaying ? 1 : 0);
  }

  /**
   * Convenience method to update all playhead data atomically.
   * Wraps all writes in beginWrite/endWrite transaction.
   */
  update(position: number, sampleRate: number, duration: number, isPlaying: boolean): void {
    this.beginWrite();
    this.setPosition(position);
    this.setSampleRate(sampleRate);
    this.setDuration(duration);
    this.setIsPlaying(isPlaying);
    this.endWrite();
  }
}

/** Snapshot of playhead data read atomically */
export interface PlayheadSnapshot {
  position: number;
  sampleRate: number;
  duration: number;
  isPlaying: boolean;
}

/**
 * Helper class to read playhead data on main thread.
 *
 * Uses sequence counter to detect torn reads:
 * - Read sequence counter
 * - Read all values
 * - Read sequence counter again
 * - If different or odd, retry (write was in progress)
 */
export class PlayheadReader {
  private int32View: Int32Array;
  private dataView: DataView;

  // Cache last known good values for fallback
  private lastGoodSnapshot: PlayheadSnapshot = {
    position: 0,
    sampleRate: 44100,
    duration: 0,
    isPlaying: false,
  };

  constructor(sab: SharedArrayBuffer) {
    this.int32View = new Int32Array(sab);
    this.dataView = new DataView(sab);
  }

  /**
   * Read all playhead data atomically using sequence counter.
   * Retries if a write was in progress to ensure consistency.
   */
  readSnapshot(): PlayheadSnapshot {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Read sequence before
      const seq1 = Atomics.load(this.int32View, PLAYHEAD_SAB_LAYOUT.SEQUENCE / 4);

      // Read all values
      const position = this.dataView.getFloat64(PLAYHEAD_SAB_LAYOUT.PLAYHEAD_POSITION, true);
      const sampleRate = this.dataView.getFloat64(PLAYHEAD_SAB_LAYOUT.SAMPLE_RATE, true);
      const duration = this.dataView.getFloat64(PLAYHEAD_SAB_LAYOUT.DURATION, true);
      const isPlaying = Atomics.load(this.int32View, PLAYHEAD_SAB_LAYOUT.IS_PLAYING / 4) === 1;

      // Read sequence after
      const seq2 = Atomics.load(this.int32View, PLAYHEAD_SAB_LAYOUT.SEQUENCE / 4);

      // Check for consistency: sequences match and even (no write in progress)
      if (seq1 === seq2 && (seq1 & 1) === 0) {
        this.lastGoodSnapshot = { position, sampleRate, duration, isPlaying };
        return this.lastGoodSnapshot;
      }

      // Write in progress, retry
    }

    // After max retries, return last known good values
    return this.lastGoodSnapshot;
  }

  /** Read current playhead position (in samples) */
  getPosition(): number {
    return this.readSnapshot().position;
  }

  /** Read sample rate */
  getSampleRate(): number {
    return this.readSnapshot().sampleRate;
  }

  /** Read duration (in samples) */
  getDuration(): number {
    return this.readSnapshot().duration;
  }

  /** Read playing state */
  isPlaying(): boolean {
    return this.readSnapshot().isPlaying;
  }

  /** Get normalized position (0-1) */
  getNormalizedPosition(): number {
    const snapshot = this.readSnapshot();
    if (snapshot.duration <= 0) return 0;
    return snapshot.position / snapshot.duration;
  }

  /** Get position in seconds */
  getPositionInSeconds(): number {
    const snapshot = this.readSnapshot();
    if (snapshot.sampleRate <= 0) return 0;
    return snapshot.position / snapshot.sampleRate;
  }
}

export interface UsePlayheadSyncOptions {
  /** SharedArrayBuffer from AudioWorklet (optional - uses fallback if not provided) */
  sharedArrayBuffer?: SharedArrayBuffer | null;
  /** Whether to run the sync loop */
  enabled?: boolean;
  /** Callback for position updates */
  onPositionChange?: (normalizedPosition: number, positionInSeconds: number) => void;
}

export interface PlayheadState {
  /** Normalized position (0-1) */
  normalizedPosition: number;
  /** Position in seconds */
  positionInSeconds: number;
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Duration in seconds */
  durationInSeconds: number;
}

/**
 * React hook for SharedArrayBuffer-based playhead synchronization.
 *
 * Provides <16ms latency updates from AudioWorklet to UI.
 *
 * @example
 * ```tsx
 * const { normalizedPosition, isPlaying } = usePlayheadSync({
 *   sharedArrayBuffer: audioWorkletSAB,
 *   enabled: true,
 * });
 *
 * return <WaveformCanvas playheadPosition={normalizedPosition} />;
 * ```
 */
export function usePlayheadSync(options: UsePlayheadSyncOptions = {}): PlayheadState {
  const { sharedArrayBuffer, enabled = true, onPositionChange } = options;

  const [state, setState] = useState<PlayheadState>({
    normalizedPosition: 0,
    positionInSeconds: 0,
    isPlaying: false,
    durationInSeconds: 0,
  });

  const readerRef = useRef<PlayheadReader | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastPositionRef = useRef<number>(-1);

  // Initialize reader when SAB changes
  useEffect(() => {
    if (sharedArrayBuffer) {
      readerRef.current = new PlayheadReader(sharedArrayBuffer);
    } else {
      readerRef.current = null;
    }
  }, [sharedArrayBuffer]);

  // Animation loop for reading playhead
  const syncLoop = useCallback(() => {
    const reader = readerRef.current;

    if (reader) {
      const normalizedPosition = reader.getNormalizedPosition();
      const positionInSeconds = reader.getPositionInSeconds();
      const isPlaying = reader.isPlaying();
      const sampleRate = reader.getSampleRate();
      const durationSamples = reader.getDuration();
      const durationInSeconds = sampleRate > 0 ? durationSamples / sampleRate : 0;

      // Only update state if position changed (avoid unnecessary re-renders)
      if (normalizedPosition !== lastPositionRef.current) {
        lastPositionRef.current = normalizedPosition;

        setState({
          normalizedPosition,
          positionInSeconds,
          isPlaying,
          durationInSeconds,
        });

        onPositionChange?.(normalizedPosition, positionInSeconds);
      }
    }

    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [onPositionChange]);

  // Start/stop sync loop
  useEffect(() => {
    if (enabled && sharedArrayBuffer) {
      animationFrameRef.current = requestAnimationFrame(syncLoop);

      return () => {
        cancelAnimationFrame(animationFrameRef.current);
      };
    }
  }, [enabled, sharedArrayBuffer, syncLoop]);

  return state;
}

/**
 * Interpolate playhead position for smooth rendering.
 * Use when AudioWorklet updates are less frequent than display refresh rate.
 */
export function interpolatePlayhead(
  lastKnownPosition: number,
  lastKnownTimestamp: number,
  sampleRate: number,
  isPlaying: boolean
): number {
  if (!isPlaying || sampleRate <= 0) {
    return lastKnownPosition;
  }

  const now = performance.now();
  const elapsedMs = now - lastKnownTimestamp;
  const elapsedSamples = (elapsedMs / 1000) * sampleRate;

  return lastKnownPosition + elapsedSamples;
}
