/**
 * PeakMeter - Real-time Peak/RMS Metering via SharedArrayBuffer
 *
 * Provides peak and RMS level metering for audio signals.
 * Uses AnalyserNode for time-domain analysis and writes
 * results to SharedArrayBuffer for UI consumption.
 *
 * Layout: 5 channels (Deck A, B, C, D, Master) × 2 floats (peak, RMS)
 * Total: 40 bytes
 */

import type { DeckId } from '../types';

/** SharedArrayBuffer layout for metering data */
export const METER_SAB_LAYOUT = {
  // 5 channels: Deck A, B, C, D, Master
  // Each channel: 2 Float32 values (peak, rms)
  DECK_A_PEAK: 0,
  DECK_A_RMS: 4,
  DECK_B_PEAK: 8,
  DECK_B_RMS: 12,
  DECK_C_PEAK: 16,
  DECK_C_RMS: 20,
  DECK_D_PEAK: 24,
  DECK_D_RMS: 28,
  MASTER_PEAK: 32,
  MASTER_RMS: 36,
  TOTAL_SIZE: 40, // bytes
} as const;

/** Map deck IDs to SAB channel offsets */
const DECK_OFFSETS: Record<DeckId, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
};

/** Master channel offset */
const MASTER_OFFSET = 4;

/** Meter data for a single channel */
export interface MeterData {
  peak: number;   // 0.0 to 1.0+
  rms: number;    // 0.0 to 1.0
}

/**
 * Create a SharedArrayBuffer for metering data
 */
export function createMeterSAB(): SharedArrayBuffer {
  return new SharedArrayBuffer(METER_SAB_LAYOUT.TOTAL_SIZE);
}

/**
 * PeakMeter - Analyzes audio and writes peak/RMS to SAB
 *
 * Usage:
 * ```typescript
 * const sab = createMeterSAB();
 * const meter = new PeakMeter(audioContext, sab, 0); // Channel 0 = Deck A
 * channelStrip.output.connect(meter.input);
 * meter.output.connect(destination);
 *
 * // Call update() in animation frame loop
 * function animate() {
 *   meter.update();
 *   requestAnimationFrame(animate);
 * }
 * ```
 */
export class PeakMeter {
  private readonly analyser: AnalyserNode;
  private readonly dataArray: Float32Array;
  private readonly view: Float32Array;

  /**
   * Create a new peak meter
   * @param context - AudioContext to create analyser
   * @param sab - SharedArrayBuffer for meter data
   * @param channelOffset - Channel offset (0=Deck A, 1=B, 2=C, 3=D, 4=Master)
   */
  constructor(
    context: AudioContext,
    sab: SharedArrayBuffer,
    channelOffset: number
  ) {
    // Create analyser node
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256; // Small for performance

    // Allocate data array for time-domain samples
    this.dataArray = new Float32Array(this.analyser.fftSize);

    // Create view into SAB for this channel
    // Each channel has 2 Float32 values (peak, rms) = 8 bytes
    this.view = new Float32Array(sab, channelOffset * 8, 2);
  }

  /**
   * Get the input node (connect sources here)
   */
  get input(): AudioNode {
    return this.analyser;
  }

  /**
   * Get the output node (pass-through - connect to destination from here)
   */
  get output(): AudioNode {
    return this.analyser;
  }

  /**
   * Update meter values by analyzing current audio data
   * Call this in requestAnimationFrame for ~60Hz updates
   */
  update(): void {
    // Get time-domain audio data
    this.analyser.getFloatTimeDomainData(this.dataArray);

    // Calculate peak and RMS
    let peak = 0;
    let sumSquares = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const sample = Math.abs(this.dataArray[i]);
      peak = Math.max(peak, sample);
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // Write to SAB (Float32 aligned, atomic writes not strictly needed)
    this.view[0] = peak;
    this.view[1] = rms;
  }

  /**
   * Disconnect analyser and release resources
   */
  dispose(): void {
    this.analyser.disconnect();
  }
}

/**
 * MeterReader - Reads peak/RMS values from SAB
 *
 * For use on the UI thread to read meter data written by PeakMeter.
 *
 * Usage:
 * ```typescript
 * const reader = new MeterReader(sab);
 *
 * function renderMeter() {
 *   const { peak, rms } = reader.getDeckMeter('A');
 *   drawVUMeter(peak, rms);
 *   requestAnimationFrame(renderMeter);
 * }
 * ```
 */
export class MeterReader {
  private readonly view: Float32Array;

  constructor(sab: SharedArrayBuffer) {
    this.view = new Float32Array(sab);
  }

  /**
   * Get peak value for a deck
   */
  getDeckPeak(deckId: DeckId): number {
    const offset = DECK_OFFSETS[deckId] * 2; // 2 floats per channel
    return this.view[offset];
  }

  /**
   * Get RMS value for a deck
   */
  getDeckRMS(deckId: DeckId): number {
    const offset = DECK_OFFSETS[deckId] * 2 + 1;
    return this.view[offset];
  }

  /**
   * Get peak and RMS for a deck
   */
  getDeckMeter(deckId: DeckId): MeterData {
    return {
      peak: this.getDeckPeak(deckId),
      rms: this.getDeckRMS(deckId),
    };
  }

  /**
   * Get master peak value
   */
  getMasterPeak(): number {
    return this.view[MASTER_OFFSET * 2];
  }

  /**
   * Get master RMS value
   */
  getMasterRMS(): number {
    return this.view[MASTER_OFFSET * 2 + 1];
  }

  /**
   * Get master peak and RMS
   */
  getMasterMeter(): MeterData {
    return {
      peak: this.getMasterPeak(),
      rms: this.getMasterRMS(),
    };
  }
}
