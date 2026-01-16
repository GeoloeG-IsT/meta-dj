/**
 * Stem Mixer Service
 *
 * Handles real-time mixing of stem audio using Web Audio API.
 * Provides mute/solo functionality with sample-accurate timing.
 *
 * Audio Graph:
 * [Stem Buffer] → [Source Node] → [Gain Node] → [Merger] → [Output]
 *                                      ↑
 *                              (mute/solo control)
 */

import type { StemType, StemBuffers } from '../types/stems';
import { STEM_TYPES } from '../types/stems';

/** Ramp time for gain changes (prevents clicks/pops) */
const GAIN_RAMP_TIME = 0.02; // 20ms

export interface StemMixerConfig {
  /** Web Audio context */
  audioContext: AudioContext;
  /** Output destination node */
  destination: AudioNode;
}

export interface StemMixerState {
  /** Current mute state for each stem */
  muted: Record<StemType, boolean>;
  /** Currently soloed stem (null = none) */
  solo: StemType | null;
  /** Whether stems are loaded and playable */
  ready: boolean;
  /** Current playback position in samples */
  positionSamples: number;
}

/**
 * Loop boundary configuration for playback looping.
 * When set, playback will jump from outPoint back to inPoint.
 */
export interface LoopBoundary {
  /** Start position in seconds */
  inPointSeconds: number;
  /** End position in seconds */
  outPointSeconds: number;
}

/**
 * Stem Mixer - manages real-time stem audio mixing.
 *
 * Usage:
 * 1. Create mixer with audio context
 * 2. Load stem buffers
 * 3. Connect to output
 * 4. Start playback
 * 5. Toggle mute/solo as needed
 */
export class StemMixer {
  private audioContext: AudioContext;
  private destination: AudioNode;

  // Audio nodes for each stem
  private sourceNodes: Map<StemType, AudioBufferSourceNode | null> = new Map();
  private gainNodes: Map<StemType, GainNode> = new Map();

  // Stem buffers
  private buffers: StemBuffers = {
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  };

  // Mixer node to combine stems (stereo output)
  private mixerNode: GainNode;

  // State
  private muted: Record<StemType, boolean> = {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  };
  private solo: StemType | null = null;
  private isPlaying = false;
  private startTime = 0;
  private startOffset = 0;

  // Loop state
  private loopBoundary: LoopBoundary | null = null;
  private loopCheckInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly LOOP_CHECK_INTERVAL_MS = 10; // Check every 10ms for responsive looping

  constructor(config: StemMixerConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;

    // Create mixer node (GainNode acts as a summing junction for stereo output)
    this.mixerNode = this.audioContext.createGain();
    this.mixerNode.gain.value = 1.0;

    // Create gain nodes for each stem
    for (const stemType of STEM_TYPES) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0;
      this.gainNodes.set(stemType, gainNode);
      this.sourceNodes.set(stemType, null);

      // Connect each stem's gain node to the mixer (additive mixing)
      gainNode.connect(this.mixerNode);
    }

    // Connect mixer to destination
    this.mixerNode.connect(this.destination);
  }

  /**
   * Load stem audio buffers.
   */
  loadStems(buffers: StemBuffers): void {
    this.buffers = { ...buffers };
    console.log('[Stem Mixer] Loaded stem buffers');
  }

  /**
   * Check if stems are loaded and ready.
   */
  isReady(): boolean {
    return (
      this.buffers.vocals !== null ||
      this.buffers.drums !== null ||
      this.buffers.bass !== null ||
      this.buffers.other !== null
    );
  }

  /**
   * Start playback from a specific position.
   *
   * @param offsetSeconds - Start position in seconds
   */
  start(offsetSeconds = 0): void {
    if (!this.isReady()) {
      console.warn('[Stem Mixer] Cannot start - no stems loaded');
      return;
    }

    // Stop any existing playback
    this.stop();

    this.startTime = this.audioContext.currentTime;
    this.startOffset = offsetSeconds;
    this.isPlaying = true;

    // Create and start source nodes for each stem
    for (const stemType of STEM_TYPES) {
      const buffer = this.buffers[stemType];
      if (!buffer) continue;

      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.loop = false;

      // Connect to gain node
      const gainNode = this.gainNodes.get(stemType)!;
      sourceNode.connect(gainNode);

      // Apply current mute/solo state
      this.updateGain(stemType);

      // Start playback
      sourceNode.start(0, offsetSeconds);

      // Store reference for later
      this.sourceNodes.set(stemType, sourceNode);

      // Handle end of playback
      sourceNode.onended = () => {
        if (this.sourceNodes.get(stemType) === sourceNode) {
          this.sourceNodes.set(stemType, null);
        }
      };
    }

    // Start loop boundary checking if loop is active
    if (this.loopBoundary) {
      this.startLoopCheck();
    }

    console.log(`[Stem Mixer] Started playback at ${offsetSeconds}s`);
  }

  /**
   * Stop playback.
   */
  stop(): void {
    // Stop loop boundary checking
    this.stopLoopCheck();

    for (const stemType of STEM_TYPES) {
      const sourceNode = this.sourceNodes.get(stemType);
      if (sourceNode) {
        try {
          sourceNode.stop();
        } catch {
          // Ignore errors if already stopped
        }
        sourceNode.disconnect();
        this.sourceNodes.set(stemType, null);
      }
    }

    this.isPlaying = false;
    console.log('[Stem Mixer] Stopped playback');
  }

  /**
   * Pause playback (remembers position).
   */
  pause(): number {
    const currentPosition = this.getCurrentPosition();
    this.stop();
    return currentPosition;
  }

  /**
   * Get current playback position in seconds.
   */
  getCurrentPosition(): number {
    if (!this.isPlaying) return this.startOffset;
    return this.audioContext.currentTime - this.startTime + this.startOffset;
  }

  /**
   * Seek to a specific position.
   */
  seek(offsetSeconds: number): void {
    if (this.isPlaying) {
      this.start(offsetSeconds);
    } else {
      this.startOffset = offsetSeconds;
    }
  }

  /**
   * Set mute state for a stem.
   */
  setMuted(stemType: StemType, muted: boolean): void {
    this.muted[stemType] = muted;
    this.updateGain(stemType);
  }

  /**
   * Toggle mute state for a stem.
   */
  toggleMute(stemType: StemType): void {
    this.setMuted(stemType, !this.muted[stemType]);
  }

  /**
   * Set solo state.
   */
  setSolo(stemType: StemType | null): void {
    this.solo = stemType;
    // Update all gains when solo changes
    for (const type of STEM_TYPES) {
      this.updateGain(type);
    }
  }

  /**
   * Toggle solo for a stem.
   */
  toggleSolo(stemType: StemType): void {
    if (this.solo === stemType) {
      this.setSolo(null); // Unsolo
    } else {
      this.setSolo(stemType); // Solo this stem
    }
  }

  /**
   * Update gain for a stem based on mute/solo state.
   */
  private updateGain(stemType: StemType): void {
    const gainNode = this.gainNodes.get(stemType);
    if (!gainNode) return;

    // Calculate effective gain
    let targetGain = 1.0;

    // If another stem is soloed, mute this one
    if (this.solo !== null && this.solo !== stemType) {
      targetGain = 0.0;
    }
    // If this stem is muted
    else if (this.muted[stemType]) {
      targetGain = 0.0;
    }

    // Use exponential ramp for smooth transition
    const now = this.audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + GAIN_RAMP_TIME);
  }

  /**
   * Get current state.
   */
  getState(): StemMixerState {
    return {
      muted: { ...this.muted },
      solo: this.solo,
      ready: this.isReady(),
      positionSamples: Math.round(
        this.getCurrentPosition() * (this.buffers.vocals?.sampleRate ?? 44100)
      ),
    };
  }

  /**
   * Set state from external source (e.g., store).
   */
  setState(muted: Record<StemType, boolean>, solo: StemType | null): void {
    this.muted = { ...muted };
    this.solo = solo;

    // Update all gains
    for (const type of STEM_TYPES) {
      this.updateGain(type);
    }
  }

  /**
   * Set loop boundary for playback looping.
   * When set, playback will jump from outPoint back to inPoint.
   *
   * @param boundary - Loop boundary in seconds, or null to disable looping
   */
  setLoop(boundary: LoopBoundary | null): void {
    this.loopBoundary = boundary;

    if (boundary) {
      console.log(`[Stem Mixer] Loop set: ${boundary.inPointSeconds.toFixed(2)}s - ${boundary.outPointSeconds.toFixed(2)}s`);
      // Start loop checking if currently playing
      if (this.isPlaying) {
        this.startLoopCheck();
      }
    } else {
      console.log('[Stem Mixer] Loop cleared');
      this.stopLoopCheck();
    }
  }

  /**
   * Get current loop boundary.
   */
  getLoop(): LoopBoundary | null {
    return this.loopBoundary;
  }

  /**
   * Check if a loop is currently active.
   */
  hasActiveLoop(): boolean {
    return this.loopBoundary !== null;
  }

  /**
   * Start the loop boundary checking interval.
   */
  private startLoopCheck(): void {
    // Don't start if already running or no loop set
    if (this.loopCheckInterval || !this.loopBoundary) return;

    this.loopCheckInterval = setInterval(() => {
      this.checkLoopBoundary();
    }, StemMixer.LOOP_CHECK_INTERVAL_MS);
  }

  /**
   * Stop the loop boundary checking interval.
   */
  private stopLoopCheck(): void {
    if (this.loopCheckInterval) {
      clearInterval(this.loopCheckInterval);
      this.loopCheckInterval = null;
    }
  }

  /**
   * Check if current position has crossed loop boundary and seek if needed.
   */
  private checkLoopBoundary(): void {
    if (!this.isPlaying || !this.loopBoundary) return;

    const currentPosition = this.getCurrentPosition();

    // Check if we've passed the out point
    if (currentPosition >= this.loopBoundary.outPointSeconds) {
      console.log(`[Stem Mixer] Loop boundary reached at ${currentPosition.toFixed(2)}s, jumping to ${this.loopBoundary.inPointSeconds.toFixed(2)}s`);
      this.seek(this.loopBoundary.inPointSeconds);
    }
  }

  /**
   * Disconnect and clean up.
   */
  dispose(): void {
    this.stop();
    this.stopLoopCheck();

    // Disconnect gain nodes
    for (const stemType of STEM_TYPES) {
      const gainNode = this.gainNodes.get(stemType);
      if (gainNode) {
        gainNode.disconnect();
      }
    }

    // Disconnect mixer
    this.mixerNode.disconnect();

    // Clear buffers
    this.buffers = {
      vocals: null,
      drums: null,
      bass: null,
      other: null,
    };

    // Clear loop state
    this.loopBoundary = null;

    console.log('[Stem Mixer] Disposed');
  }
}

/**
 * Create a stem mixer instance.
 */
export function createStemMixer(config: StemMixerConfig): StemMixer {
  return new StemMixer(config);
}
