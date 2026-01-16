/**
 * DeckEngineService - Lifecycle management for AudioWorklet deck engines
 *
 * Provides a singleton service that manages DeckEngineNode instances for
 * all four decks. Handles:
 * - AudioWorklet module loading
 * - Deck engine creation and disposal
 * - AudioContext management
 * - Connection to audio output
 */

import type { DeckId } from '../types';
import { DeckEngineNode, resampleBuffer } from '../worklet/deck-engine.node';
import { useAudioStore } from '../store/audio.store';

/** Deck engine instance with associated metadata */
interface DeckEngineInstance {
  engine: DeckEngineNode;
  deckId: DeckId;
  trackId: number | null;
  gainNode: GainNode | null;
}

/**
 * DeckEngineService - Manages AudioWorklet deck engines
 *
 * Usage:
 * ```typescript
 * const service = DeckEngineService.getInstance();
 * await service.initialize();
 *
 * // Load and play a track
 * await service.loadTrack('A', audioBuffer, trackId);
 * service.play('A');
 * ```
 */
class DeckEngineServiceClass {
  private static instance: DeckEngineServiceClass | null = null;

  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private decks: Map<DeckId, DeckEngineInstance> = new Map();
  private initialized = false;
  private initializing = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DeckEngineServiceClass {
    if (!DeckEngineServiceClass.instance) {
      DeckEngineServiceClass.instance = new DeckEngineServiceClass();
    }
    return DeckEngineServiceClass.instance;
  }

  /**
   * Initialize the service - must be called before using deck engines
   * Should be called after user gesture (click/tap) due to AudioContext restrictions
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      // Wait for existing initialization
      while (this.initializing) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return;
    }

    this.initializing = true;

    try {
      // Create AudioContext
      this.audioContext = new AudioContext();

      // Resume if suspended (browsers require user gesture)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Load the AudioWorklet module
      await DeckEngineNode.loadModule(this.audioContext);

      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioContext.destination);

      // Create deck engines for all four decks
      const deckIds: DeckId[] = ['A', 'B', 'C', 'D'];
      for (const deckId of deckIds) {
        await this.createDeckEngine(deckId);
      }

      this.initialized = true;
      console.log('[DeckEngineService] Initialized successfully');
    } catch (error) {
      console.error('[DeckEngineService] Initialization failed:', error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the AudioContext
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get a deck engine instance
   */
  getDeckEngine(deckId: DeckId): DeckEngineNode | null {
    return this.decks.get(deckId)?.engine ?? null;
  }

  /**
   * Get the SharedArrayBuffer for a deck (for usePlayheadSync hook)
   */
  getPlayheadSAB(deckId: DeckId): SharedArrayBuffer | null {
    return this.decks.get(deckId)?.engine.sharedArrayBuffer ?? null;
  }

  /**
   * Load an audio buffer into a deck
   * @param deckId - Target deck
   * @param audioBuffer - Audio data to load
   * @param trackId - Track ID for state management
   */
  async loadTrack(deckId: DeckId, audioBuffer: AudioBuffer, trackId: number): Promise<void> {
    if (!this.initialized || !this.audioContext) {
      throw new Error('DeckEngineService not initialized');
    }

    const deckInstance = this.decks.get(deckId);
    if (!deckInstance) {
      throw new Error(`Deck ${deckId} not found`);
    }

    // Resample to match AudioContext sample rate if needed
    const targetSampleRate = this.audioContext.sampleRate;
    let bufferToLoad = audioBuffer;

    if (audioBuffer.sampleRate !== targetSampleRate) {
      console.log(
        `[DeckEngineService] Resampling ${deckId}: ${audioBuffer.sampleRate}Hz -> ${targetSampleRate}Hz`
      );
      bufferToLoad = await resampleBuffer(audioBuffer, targetSampleRate);
    }

    // Load into engine
    await deckInstance.engine.loadBuffer(bufferToLoad);
    deckInstance.trackId = trackId;

    // Update store
    useAudioStore.getState().setPlaying(deckId, false);
    useAudioStore.getState().setPosition(deckId, 0);
  }

  /**
   * Start playback on a deck
   */
  play(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.play();
      useAudioStore.getState().setPlaying(deckId, true);
    }
  }

  /**
   * Pause playback on a deck
   */
  pause(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.pause();
      useAudioStore.getState().setPlaying(deckId, false);
    }
  }

  /**
   * Stop playback and reset position
   */
  stop(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.stop();
      useAudioStore.getState().setPlaying(deckId, false);
      useAudioStore.getState().setPosition(deckId, 0);
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      if (engine.isPlaying) {
        this.pause(deckId);
      } else {
        this.play(deckId);
      }
    }
  }

  /**
   * Seek to a position in samples
   */
  seek(deckId: DeckId, positionSamples: number): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.seek(positionSamples);
    }
  }

  /**
   * Seek to a position in seconds
   */
  seekToSeconds(deckId: DeckId, positionSeconds: number): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.seekToSeconds(positionSeconds);
    }
  }

  /**
   * Seek to a normalized position (0-1)
   */
  seekToNormalized(deckId: DeckId, normalizedPosition: number): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.seekToNormalized(normalizedPosition);
    }
  }

  /**
   * Set the cue point at current position
   */
  setCuePoint(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.setCuePointAtCurrent();
    }
  }

  /**
   * Jump to the cue point
   */
  jumpToCue(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.jumpToCue();
    }
  }

  /**
   * Set a loop region
   */
  setLoop(deckId: DeckId, startSamples: number, endSamples: number): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.setLoop(startSamples, endSamples);
    }
  }

  /**
   * Clear the loop region
   */
  clearLoop(deckId: DeckId): void {
    const engine = this.getDeckEngine(deckId);
    if (engine) {
      engine.clearLoop();
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
      useAudioStore.getState().setMasterVolume(volume);
    }
  }

  /**
   * Set volume for a specific deck
   * @param deckId - Target deck
   * @param volume - Volume level (0-1)
   */
  setDeckVolume(deckId: DeckId, volume: number): void {
    const deckInstance = this.decks.get(deckId);
    if (deckInstance?.gainNode) {
      deckInstance.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get volume for a specific deck
   */
  getDeckVolume(deckId: DeckId): number {
    const deckInstance = this.decks.get(deckId);
    return deckInstance?.gainNode?.gain.value ?? 1;
  }

  /**
   * Get the current playhead position for a deck in samples
   */
  getPosition(deckId: DeckId): number {
    return this.getDeckEngine(deckId)?.position ?? 0;
  }

  /**
   * Get the current playhead position for a deck in seconds
   */
  getPositionInSeconds(deckId: DeckId): number {
    return this.getDeckEngine(deckId)?.positionInSeconds ?? 0;
  }

  /**
   * Get the normalized playhead position for a deck (0-1)
   */
  getNormalizedPosition(deckId: DeckId): number {
    return this.getDeckEngine(deckId)?.normalizedPosition ?? 0;
  }

  /**
   * Eject a track from a deck
   */
  ejectTrack(deckId: DeckId): void {
    const deckInstance = this.decks.get(deckId);
    if (deckInstance) {
      deckInstance.engine.stop();
      deckInstance.trackId = null;
      useAudioStore.getState().ejectTrack(deckId);
    }
  }

  /**
   * Dispose of the service and release resources
   */
  async dispose(): Promise<void> {
    // Dispose all deck engines and their gain nodes
    for (const [_deckId, instance] of this.decks) {
      instance.engine.dispose();
      if (instance.gainNode) {
        instance.gainNode.disconnect();
      }
    }
    this.decks.clear();

    // Disconnect master gain
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    // Close AudioContext
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.initialized = false;

    // Reset singleton for clean reinitialization (useful for tests/hot reload)
    DeckEngineServiceClass.instance = null;

    console.log('[DeckEngineService] Disposed');
  }

  /**
   * Create a deck engine for a specific deck
   */
  private async createDeckEngine(deckId: DeckId): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('AudioContext not initialized');
    }

    // Create the deck engine
    const engine = new DeckEngineNode(this.audioContext, true);

    // Create per-deck gain node for individual volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;

    // Connect: engine -> deck gain -> master gain
    engine.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Set up event handlers
    engine.on('stateChanged', (payload) => {
      useAudioStore.getState().setPlaying(deckId, payload.isPlaying);
    });

    engine.on('playbackEnded', () => {
      useAudioStore.getState().setPlaying(deckId, false);
    });

    // Store the instance
    this.decks.set(deckId, {
      engine,
      deckId,
      trackId: null,
      gainNode,
    });
  }
}

// Export singleton instance getter
export const DeckEngineService = DeckEngineServiceClass.getInstance();

// Export type for external use
export type { DeckEngineInstance };
