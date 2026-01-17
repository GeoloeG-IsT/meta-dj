/**
 * DeckEngineService - Lifecycle management for AudioWorklet deck engines
 *
 * Provides a singleton service that manages DeckEngineNode instances for
 * all four decks. Handles:
 * - AudioWorklet module loading
 * - Deck engine creation and disposal
 * - AudioContext management
 * - Connection to audio output
 * - 3-band EQ per deck
 * - Master bus with limiter
 * - Peak metering
 */

import type { DeckId } from '../types';
import { DeckEngineNode, resampleBuffer } from '../worklet/deck-engine.node';
import { useAudioStore } from '../store/audio.store';
import { ChannelStrip } from '../dsp/channel-strip';
import { MasterBus } from '../dsp/master-bus';
import { PeakMeter, createMeterSAB } from '../dsp/peak-meter';

/** Map deck IDs to meter channel offsets */
const DECK_METER_OFFSETS: Record<DeckId, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
};

/** Deck engine instance with associated metadata */
interface DeckEngineInstance {
  engine: DeckEngineNode;
  deckId: DeckId;
  trackId: number | null;
  channelStrip: ChannelStrip;
  peakMeter: PeakMeter;
}

/** EQ band type */
type EQBand = 'low' | 'mid' | 'high';

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
 *
 * // EQ and gain control
 * service.setDeckEQ('A', 'low', -6);
 * service.setDeckGain('A', 0.8);
 * service.setMasterGain(0.9);
 * ```
 */
class DeckEngineServiceClass {
  private static instance: DeckEngineServiceClass | null = null;

  private audioContext: AudioContext | null = null;
  private masterBus: MasterBus | null = null;
  private meterSAB: SharedArrayBuffer | null = null;
  private decks: Map<DeckId, DeckEngineInstance> = new Map();
  private initialized = false;
  private initializing = false;
  private meterUpdateId: number = 0;
  private isMeterUpdating = false;

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

      // Create shared SAB for all metering
      this.meterSAB = createMeterSAB();

      // Create master bus with limiter and metering
      this.masterBus = new MasterBus(this.audioContext, this.meterSAB);
      this.masterBus.connect(this.audioContext.destination);

      // Create deck engines for all four decks
      const deckIds: DeckId[] = ['A', 'B', 'C', 'D'];
      for (const deckId of deckIds) {
        await this.createDeckEngine(deckId);
      }

      // Start automatic meter updates
      this.startMeterUpdates();

      this.initialized = true;
      console.log('[DeckEngineService] Initialized with EQ, limiter, and metering');
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
   * Get the SharedArrayBuffer for a deck's playhead (for usePlayheadSync hook)
   */
  getPlayheadSAB(deckId: DeckId): SharedArrayBuffer | null {
    return this.decks.get(deckId)?.engine.sharedArrayBuffer ?? null;
  }

  /**
   * Get the SharedArrayBuffer for metering (for usePeakMeter hook)
   */
  getMeteringSAB(): SharedArrayBuffer | null {
    return this.meterSAB;
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

  // ============ EQ Methods ============

  /**
   * Set EQ band for a specific deck
   * @param deckId - Target deck
   * @param band - EQ band ('low', 'mid', 'high')
   * @param db - Gain in decibels (-24 to +6)
   */
  setDeckEQ(deckId: DeckId, band: EQBand, db: number): void {
    const deckInstance = this.decks.get(deckId);
    if (!deckInstance) return;

    switch (band) {
      case 'low':
        deckInstance.channelStrip.setLow(db);
        break;
      case 'mid':
        deckInstance.channelStrip.setMid(db);
        break;
      case 'high':
        deckInstance.channelStrip.setHigh(db);
        break;
    }
  }

  /**
   * Get EQ values for a specific deck
   * @param deckId - Target deck
   * @returns Object with low, mid, high values in dB
   */
  getDeckEQ(deckId: DeckId): { low: number; mid: number; high: number } {
    const deckInstance = this.decks.get(deckId);
    if (!deckInstance) {
      return { low: 0, mid: 0, high: 0 };
    }

    return {
      low: deckInstance.channelStrip.getLow(),
      mid: deckInstance.channelStrip.getMid(),
      high: deckInstance.channelStrip.getHigh(),
    };
  }

  // ============ Gain Methods ============

  /**
   * Set channel gain for a specific deck
   * @param deckId - Target deck
   * @param value - Gain value (0.0 to 1.5)
   */
  setDeckGain(deckId: DeckId, value: number): void {
    const deckInstance = this.decks.get(deckId);
    if (deckInstance) {
      deckInstance.channelStrip.setGain(value);
    }
  }

  /**
   * Get channel gain for a specific deck
   */
  getDeckGain(deckId: DeckId): number {
    const deckInstance = this.decks.get(deckId);
    return deckInstance?.channelStrip.getGain() ?? 1;
  }

  /**
   * Set volume for a specific deck (alias for setDeckGain for backward compatibility)
   * @param deckId - Target deck
   * @param volume - Volume level (0-1.5)
   */
  setDeckVolume(deckId: DeckId, volume: number): void {
    this.setDeckGain(deckId, volume);
  }

  /**
   * Get volume for a specific deck (alias for getDeckGain for backward compatibility)
   */
  getDeckVolume(deckId: DeckId): number {
    return this.getDeckGain(deckId);
  }

  /**
   * Set master gain
   * @param value - Gain value (0.0 to 1.5)
   */
  setMasterGain(value: number): void {
    if (this.masterBus) {
      this.masterBus.setMasterGain(value);
      useAudioStore.getState().setMasterVolume(value);
    }
  }

  /**
   * Get master gain
   */
  getMasterGain(): number {
    return this.masterBus?.getMasterGain() ?? 1;
  }

  /**
   * Set master volume (alias for setMasterGain for backward compatibility)
   */
  setMasterVolume(volume: number): void {
    this.setMasterGain(volume);
  }

  // ============ Position Methods ============

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

  // ============ Metering Methods ============

  /**
   * Start automatic meter updates (already called in initialize)
   */
  private startMeterUpdates(): void {
    if (this.isMeterUpdating) return;
    this.isMeterUpdating = true;

    const updateLoop = () => {
      // Update all deck meters
      for (const [, instance] of this.decks) {
        instance.peakMeter.update();
      }
      // Update master meter
      if (this.masterBus) {
        this.masterBus.update();
      }

      if (this.isMeterUpdating) {
        this.meterUpdateId = requestAnimationFrame(updateLoop);
      }
    };

    this.meterUpdateId = requestAnimationFrame(updateLoop);
  }

  /**
   * Stop automatic meter updates
   */
  private stopMeterUpdates(): void {
    this.isMeterUpdating = false;
    if (this.meterUpdateId) {
      cancelAnimationFrame(this.meterUpdateId);
      this.meterUpdateId = 0;
    }
  }

  /**
   * Dispose of the service and release resources
   */
  async dispose(): Promise<void> {
    // Stop meter updates
    this.stopMeterUpdates();

    // Dispose all deck engines and channel strips
    for (const [, instance] of this.decks) {
      instance.engine.dispose();
      instance.channelStrip.dispose();
      instance.peakMeter.dispose();
    }
    this.decks.clear();

    // Dispose master bus
    if (this.masterBus) {
      this.masterBus.dispose();
      this.masterBus = null;
    }

    // Clear SAB reference
    this.meterSAB = null;

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
    if (!this.audioContext || !this.masterBus || !this.meterSAB) {
      throw new Error('AudioContext not initialized');
    }

    // Create the deck engine
    const engine = new DeckEngineNode(this.audioContext, true);

    // Create channel strip (EQ + Gain)
    const channelStrip = new ChannelStrip(this.audioContext);

    // Create peak meter for this deck
    const peakMeter = new PeakMeter(
      this.audioContext,
      this.meterSAB,
      DECK_METER_OFFSETS[deckId]
    );

    // Wire: Engine → ChannelStrip → PeakMeter → MasterBus
    engine.connect(channelStrip.input);
    channelStrip.output.connect(peakMeter.input);
    peakMeter.output.connect(this.masterBus.input);

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
      channelStrip,
      peakMeter,
    });
  }
}

// Export singleton instance getter
export const DeckEngineService = DeckEngineServiceClass.getInstance();

// Export type for external use
export type { DeckEngineInstance, EQBand };
