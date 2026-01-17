/**
 * MasterBus - Master Output Bus with Limiter and Metering
 *
 * Sums all deck outputs, applies master gain and limiting,
 * and provides peak metering for the master output.
 *
 * Signal path:
 *   Deck Channel Strips → MasterBus Input → Master Gain → Limiter → [PeakMeter] → Destination
 */

import { MasterLimiter } from './master-limiter';
import { PeakMeter, createMeterSAB, METER_SAB_LAYOUT } from './peak-meter';

/** Master channel offset in metering SAB */
const MASTER_METER_OFFSET = 4; // After 4 deck channels

/**
 * Master Bus - Combines all deck outputs with limiting and metering
 *
 * Usage:
 * ```typescript
 * const masterBus = new MasterBus(audioContext);
 * channelStripA.output.connect(masterBus.input);
 * channelStripB.output.connect(masterBus.input);
 * masterBus.connect(audioContext.destination);
 *
 * masterBus.setMasterGain(0.9);
 * masterBus.update(); // Call in animation frame for metering
 * ```
 */
export class MasterBus {
  private readonly limiter: MasterLimiter;
  private readonly masterMeter: PeakMeter;
  private readonly meterSAB: SharedArrayBuffer;
  private animationFrameId: number = 0;
  private isUpdating: boolean = false;

  /**
   * Create a new master bus
   * @param context - AudioContext to create nodes
   * @param existingSAB - Optional existing SharedArrayBuffer (for sharing with deck meters)
   */
  constructor(
    private readonly context: AudioContext,
    existingSAB?: SharedArrayBuffer
  ) {
    // Create or use existing SAB for metering
    this.meterSAB = existingSAB || createMeterSAB();

    // Create master limiter
    this.limiter = new MasterLimiter(context);

    // Create master peak meter (inserted after limiter)
    this.masterMeter = new PeakMeter(context, this.meterSAB, MASTER_METER_OFFSET);

    // Wire: Limiter output → PeakMeter → (connect() call later)
    this.limiter.output.connect(this.masterMeter.input);
  }

  /**
   * Get the input node (connect deck channel strips here)
   * Multiple decks can connect to this single input node
   */
  get input(): AudioNode {
    return this.limiter.input;
  }

  /**
   * Get the output node (connect to destination from here)
   */
  get output(): AudioNode {
    return this.masterMeter.output;
  }

  /**
   * Get the SharedArrayBuffer for metering data
   */
  get meteringSAB(): SharedArrayBuffer {
    return this.meterSAB;
  }

  /**
   * Connect to an audio destination
   */
  connect(destination: AudioNode): void {
    this.masterMeter.output.connect(destination);
  }

  /**
   * Disconnect from destination
   */
  disconnect(): void {
    this.masterMeter.output.disconnect();
  }

  /**
   * Get the compressor's current gain reduction in dB
   * Useful for showing compression activity
   */
  get reduction(): number {
    return this.limiter.reduction;
  }

  /**
   * Set master gain with smooth ramping
   * @param value - Gain value (0.0 to 1.5)
   */
  setMasterGain(value: number): void {
    this.limiter.setMasterGain(value);
  }

  /**
   * Get current master gain
   */
  getMasterGain(): number {
    return this.limiter.getMasterGain();
  }

  /**
   * Update master meter values
   * Call this in requestAnimationFrame for ~60Hz updates
   */
  update(): void {
    this.masterMeter.update();
  }

  /**
   * Start automatic meter updates
   * Call this to start updating meters automatically
   */
  startMeterUpdates(): void {
    if (this.isUpdating) return;
    this.isUpdating = true;

    const updateLoop = () => {
      this.masterMeter.update();
      if (this.isUpdating) {
        this.animationFrameId = requestAnimationFrame(updateLoop);
      }
    };

    this.animationFrameId = requestAnimationFrame(updateLoop);
  }

  /**
   * Stop automatic meter updates
   */
  stopMeterUpdates(): void {
    this.isUpdating = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  /**
   * Disconnect all nodes and release resources
   */
  dispose(): void {
    this.stopMeterUpdates();
    this.masterMeter.dispose();
    this.limiter.dispose();
  }
}
