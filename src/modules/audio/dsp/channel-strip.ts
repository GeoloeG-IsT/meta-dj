/**
 * ChannelStrip - Per-Deck EQ + Gain Chain
 *
 * Combines the 3-band EQ with a gain node for per-deck
 * volume control. Provides the complete signal path:
 *
 *   Input → EQ (Low → Mid → High) → Gain → Output
 *
 * Uses exponential ramping for smooth gain transitions
 * to prevent audio clicks/pops.
 */

import { EQProcessor } from './eq-processor';

/** Gain range limits */
export const GAIN_LIMITS = {
  MIN: 0.0,
  MAX: 1.5,
  DEFAULT: 1.0,
} as const;

/** Ramp time for smooth gain transitions (seconds) */
const GAIN_RAMP_TIME = 0.01; // 10ms

/**
 * Channel Strip - EQ + Gain for a single deck
 *
 * Usage:
 * ```typescript
 * const strip = new ChannelStrip(audioContext);
 * deckEngineNode.connect(strip.input);
 * strip.output.connect(masterBus);
 *
 * strip.setLow(-6);    // EQ control
 * strip.setGain(0.8);  // Volume control
 * ```
 */
export class ChannelStrip {
  private readonly eq: EQProcessor;
  private readonly gainNode: GainNode;
  private currentGain: number = GAIN_LIMITS.DEFAULT;

  /**
   * Create a new channel strip
   * @param context - AudioContext to create nodes
   */
  constructor(private readonly context: AudioContext) {
    // Create EQ processor
    this.eq = new EQProcessor(context);

    // Create gain node for volume control
    this.gainNode = context.createGain();
    this.gainNode.gain.value = GAIN_LIMITS.DEFAULT;

    // Wire: EQ output → Gain
    this.eq.output.connect(this.gainNode);
  }

  /**
   * Get the input node (connect sources here)
   */
  get input(): AudioNode {
    return this.eq.input;
  }

  /**
   * Get the output node (connect to destination from here)
   */
  get output(): AudioNode {
    return this.gainNode;
  }

  // ============ EQ Methods ============

  /**
   * Set low band gain
   * @param db - Gain in decibels (-24 to +6)
   */
  setLow(db: number): void {
    this.eq.setLow(db);
  }

  /**
   * Set mid band gain
   * @param db - Gain in decibels (-24 to +6)
   */
  setMid(db: number): void {
    this.eq.setMid(db);
  }

  /**
   * Set high band gain
   * @param db - Gain in decibels (-24 to +6)
   */
  setHigh(db: number): void {
    this.eq.setHigh(db);
  }

  /**
   * Get current low band gain
   */
  getLow(): number {
    return this.eq.getLow();
  }

  /**
   * Get current mid band gain
   */
  getMid(): number {
    return this.eq.getMid();
  }

  /**
   * Get current high band gain
   */
  getHigh(): number {
    return this.eq.getHigh();
  }

  // ============ Gain Methods ============

  /**
   * Set channel gain with smooth ramping
   * @param value - Gain value (0.0 to 1.5)
   */
  setGain(value: number): void {
    // Clamp to valid range
    this.currentGain = Math.max(GAIN_LIMITS.MIN, Math.min(GAIN_LIMITS.MAX, value));

    // Use exponential ramp for smooth transition (avoid clicks)
    // Note: exponentialRampToValueAtTime can't go to 0, use small value
    const targetValue = Math.max(0.0001, this.currentGain);
    const now = this.context.currentTime;
    this.gainNode.gain.exponentialRampToValueAtTime(targetValue, now + GAIN_RAMP_TIME);
  }

  /**
   * Get current channel gain
   */
  getGain(): number {
    return this.currentGain;
  }

  /**
   * Disconnect all nodes and release resources
   */
  dispose(): void {
    this.eq.dispose();
    this.gainNode.disconnect();
  }
}
