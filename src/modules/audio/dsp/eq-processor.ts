/**
 * EQProcessor - 3-Band Parametric EQ
 *
 * Implements a standard DJ-style 3-band EQ with:
 * - Low shelf filter at 320Hz
 * - Mid peaking filter at 1kHz (Q=0.7)
 * - High shelf filter at 3.2kHz
 *
 * Each band can be adjusted from -24dB to +6dB.
 * Web Audio API handles parameter smoothing automatically.
 */

/** EQ band frequencies */
export const EQ_FREQUENCIES = {
  LOW: 320,
  MID: 1000,
  HIGH: 3200,
} as const;

/** EQ gain range limits (dB) */
export const EQ_GAIN_LIMITS = {
  MIN: -24,
  MAX: 6,
} as const;

/** Mid band Q factor */
export const EQ_MID_Q = 0.7;

/**
 * 3-Band Parametric EQ Processor
 *
 * Usage:
 * ```typescript
 * const eq = new EQProcessor(audioContext);
 * sourceNode.connect(eq.input);
 * eq.output.connect(destinationNode);
 *
 * eq.setLow(-6);  // Cut bass by 6dB
 * eq.setMid(3);   // Boost mids by 3dB
 * eq.setHigh(0);  // Flat highs
 * ```
 */
export class EQProcessor {
  private readonly low: BiquadFilterNode;
  private readonly mid: BiquadFilterNode;
  private readonly high: BiquadFilterNode;

  /**
   * Create a new EQ processor
   * @param context - AudioContext to create filter nodes
   */
  constructor(context: AudioContext) {
    // Low shelf: affects frequencies below 320Hz
    this.low = context.createBiquadFilter();
    this.low.type = 'lowshelf';
    this.low.frequency.value = EQ_FREQUENCIES.LOW;
    this.low.gain.value = 0;

    // Mid peaking: centered at 1kHz with moderate Q
    this.mid = context.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.frequency.value = EQ_FREQUENCIES.MID;
    this.mid.Q.value = EQ_MID_Q;
    this.mid.gain.value = 0;

    // High shelf: affects frequencies above 3.2kHz
    this.high = context.createBiquadFilter();
    this.high.type = 'highshelf';
    this.high.frequency.value = EQ_FREQUENCIES.HIGH;
    this.high.gain.value = 0;

    // Chain: Input → Low → Mid → High → Output
    this.low.connect(this.mid);
    this.mid.connect(this.high);
  }

  /**
   * Get the input node (connect sources here)
   */
  get input(): AudioNode {
    return this.low;
  }

  /**
   * Get the output node (connect to destination from here)
   */
  get output(): AudioNode {
    return this.high;
  }

  /**
   * Clamp a gain value to the valid range
   */
  private clampGain(db: number): number {
    return Math.max(EQ_GAIN_LIMITS.MIN, Math.min(EQ_GAIN_LIMITS.MAX, db));
  }

  /**
   * Set low band gain
   * @param db - Gain in decibels (-24 to +6)
   */
  setLow(db: number): void {
    this.low.gain.value = this.clampGain(db);
  }

  /**
   * Set mid band gain
   * @param db - Gain in decibels (-24 to +6)
   */
  setMid(db: number): void {
    this.mid.gain.value = this.clampGain(db);
  }

  /**
   * Set high band gain
   * @param db - Gain in decibels (-24 to +6)
   */
  setHigh(db: number): void {
    this.high.gain.value = this.clampGain(db);
  }

  /**
   * Get current low band gain
   */
  getLow(): number {
    return this.low.gain.value;
  }

  /**
   * Get current mid band gain
   */
  getMid(): number {
    return this.mid.gain.value;
  }

  /**
   * Get current high band gain
   */
  getHigh(): number {
    return this.high.gain.value;
  }

  /**
   * Disconnect all filters and release resources
   */
  dispose(): void {
    this.low.disconnect();
    this.mid.disconnect();
    this.high.disconnect();
  }
}
