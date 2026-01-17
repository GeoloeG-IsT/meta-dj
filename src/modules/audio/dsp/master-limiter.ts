/**
 * MasterLimiter - Master Bus Limiter
 *
 * Provides a brick wall limiter on the master output to prevent
 * clipping. Uses DynamicsCompressorNode configured for hard limiting.
 *
 * Signal path: Master Gain → Limiter → Destination
 *
 * Limiter settings:
 * - Threshold: -3dB (brick wall)
 * - Knee: 0 (hard knee)
 * - Ratio: 20:1 (effective limiting)
 * - Attack: 1ms (fast)
 * - Release: 100ms (moderate)
 */

/** Limiter compressor settings */
export const LIMITER_SETTINGS = {
  THRESHOLD: -3,      // dB - Start limiting at -3dB (brick wall)
  KNEE: 0,            // dB - Hard knee for true limiting
  RATIO: 20,          // 20:1 ratio - strong limiting (Web Audio max is 20)
  ATTACK: 0.001,      // seconds - 1ms fast attack
  RELEASE: 0.1,       // seconds - 100ms release
} as const;

/** Master gain range limits */
export const MASTER_GAIN_LIMITS = {
  MIN: 0.0,
  MAX: 1.5,
  DEFAULT: 1.0,
} as const;

/** Ramp time for smooth gain transitions (seconds) */
const GAIN_RAMP_TIME = 0.01; // 10ms

/**
 * Master Bus Limiter
 *
 * Usage:
 * ```typescript
 * const limiter = new MasterLimiter(audioContext);
 * deckChannelStrip.output.connect(limiter.input);
 * limiter.output.connect(audioContext.destination);
 *
 * limiter.setMasterGain(0.9);  // Set master volume
 * ```
 */
export class MasterLimiter {
  private readonly masterGain: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private currentGain: number = MASTER_GAIN_LIMITS.DEFAULT;

  /**
   * Create a new master limiter
   * @param context - AudioContext to create nodes
   */
  constructor(private readonly context: AudioContext) {
    // Create master gain node
    this.masterGain = context.createGain();
    this.masterGain.gain.value = MASTER_GAIN_LIMITS.DEFAULT;

    // Create and configure limiter
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = LIMITER_SETTINGS.THRESHOLD;
    this.compressor.knee.value = LIMITER_SETTINGS.KNEE;
    this.compressor.ratio.value = LIMITER_SETTINGS.RATIO;
    this.compressor.attack.value = LIMITER_SETTINGS.ATTACK;
    this.compressor.release.value = LIMITER_SETTINGS.RELEASE;

    // Wire: Master Gain → Limiter
    this.masterGain.connect(this.compressor);
  }

  /**
   * Get the input node (connect deck outputs here)
   */
  get input(): AudioNode {
    return this.masterGain;
  }

  /**
   * Get the output node (connect to destination from here)
   */
  get output(): AudioNode {
    return this.compressor;
  }

  /**
   * Get the compressor's reduction in dB (for metering)
   * Useful for showing compression activity
   */
  get reduction(): number {
    return this.compressor.reduction;
  }

  /**
   * Set master gain with smooth ramping
   * @param value - Gain value (0.0 to 1.5)
   */
  setMasterGain(value: number): void {
    // Clamp to valid range
    this.currentGain = Math.max(MASTER_GAIN_LIMITS.MIN, Math.min(MASTER_GAIN_LIMITS.MAX, value));

    // Use exponential ramp for smooth transition (avoid clicks)
    // Note: exponentialRampToValueAtTime can't go to 0, use small value
    const targetValue = Math.max(0.0001, this.currentGain);
    const now = this.context.currentTime;
    this.masterGain.gain.exponentialRampToValueAtTime(targetValue, now + GAIN_RAMP_TIME);
  }

  /**
   * Get current master gain
   */
  getMasterGain(): number {
    return this.currentGain;
  }

  /**
   * Disconnect all nodes and release resources
   */
  dispose(): void {
    this.masterGain.disconnect();
    this.compressor.disconnect();
  }
}
