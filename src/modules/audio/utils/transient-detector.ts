/**
 * Transient Detector - Peak detection for magnetic snap
 *
 * Detects transient peaks in waveform data for snap-to-transient functionality
 * during beatgrid editing.
 *
 * Story 2.3: "Slip-Under" Beatgrid Editing
 */

import type { WaveformData } from '../analysis/waveform-analyzer';

/** Result of finding nearest transient */
export interface TransientSearchResult {
  /** Whether a transient was found within threshold */
  found: boolean;
  /** Sample position of the nearest transient (if found) */
  samplePosition: number | null;
  /** Distance in samples from search position to transient */
  distance: number | null;
  /** Index in the transients array */
  index: number | null;
}

/** Configuration for transient detection */
export interface TransientDetectorConfig {
  /** Minimum peak amplitude threshold (0-1) */
  amplitudeThreshold: number;
  /** Minimum distance between peaks in samples */
  minPeakDistance: number;
  /** Snap threshold in samples (default ~10ms at 44.1kHz = 441 samples) */
  snapThreshold: number;
}

/** Default configuration */
export const DEFAULT_TRANSIENT_CONFIG: TransientDetectorConfig = {
  amplitudeThreshold: 0.3, // 30% of max amplitude
  minPeakDistance: 512, // ~11ms at 44.1kHz, prevents detecting same transient multiple times
  snapThreshold: 441, // 10ms at 44.1kHz
};

/**
 * Detect transient peaks in waveform data.
 *
 * Uses a simple peak detection algorithm that finds local maxima
 * above a threshold amplitude. This is optimized for beat/transient
 * detection, not for general audio analysis.
 *
 * @param waveformData - Waveform data from analyzer
 * @param config - Detection configuration
 * @returns Array of sample positions where transients were detected
 */
export function detectTransients(
  waveformData: WaveformData,
  config: Partial<TransientDetectorConfig> = {}
): number[] {
  const { amplitudeThreshold, minPeakDistance } = {
    ...DEFAULT_TRANSIENT_CONFIG,
    ...config,
  };

  const peaks = waveformData.peaks;
  if (!peaks || peaks.length === 0) {
    return [];
  }

  const transients: number[] = [];
  const samplesPerPeak = waveformData.samplesPerPeak;

  // Find local maxima above threshold
  for (let i = 1; i < peaks.length - 1; i++) {
    const current = peaks[i];
    const prev = peaks[i - 1];
    const next = peaks[i + 1];

    // Check if this is a local maximum above threshold
    if (current >= amplitudeThreshold && current > prev && current > next) {
      const samplePosition = i * samplesPerPeak;

      // Check minimum distance from last detected transient
      if (
        transients.length === 0 ||
        samplePosition - transients[transients.length - 1] >= minPeakDistance
      ) {
        transients.push(samplePosition);
      }
    }
  }

  return transients;
}

/**
 * Find the nearest transient to a given sample position.
 *
 * Uses binary search for O(log n) lookup performance.
 *
 * @param transients - Sorted array of transient sample positions
 * @param samplePosition - Target sample position to search from
 * @param threshold - Maximum distance in samples to consider a match
 * @returns Search result with nearest transient info
 */
export function findNearestTransient(
  transients: number[],
  samplePosition: number,
  threshold: number = DEFAULT_TRANSIENT_CONFIG.snapThreshold
): TransientSearchResult {
  if (transients.length === 0) {
    return { found: false, samplePosition: null, distance: null, index: null };
  }

  // Binary search for closest transient
  let left = 0;
  let right = transients.length - 1;

  // Handle edge cases
  if (samplePosition <= transients[0]) {
    const distance = Math.abs(transients[0] - samplePosition);
    return {
      found: distance <= threshold,
      samplePosition: transients[0],
      distance,
      index: 0,
    };
  }

  if (samplePosition >= transients[right]) {
    const distance = Math.abs(transients[right] - samplePosition);
    return {
      found: distance <= threshold,
      samplePosition: transients[right],
      distance,
      index: right,
    };
  }

  // Binary search
  while (left < right - 1) {
    const mid = Math.floor((left + right) / 2);
    if (transients[mid] <= samplePosition) {
      left = mid;
    } else {
      right = mid;
    }
  }

  // Check which of the two candidates is closer
  const distLeft = Math.abs(transients[left] - samplePosition);
  const distRight = Math.abs(transients[right] - samplePosition);

  if (distLeft <= distRight) {
    return {
      found: distLeft <= threshold,
      samplePosition: transients[left],
      distance: distLeft,
      index: left,
    };
  } else {
    return {
      found: distRight <= threshold,
      samplePosition: transients[right],
      distance: distRight,
      index: right,
    };
  }
}

/**
 * Calculate snap threshold in samples for a given sample rate.
 *
 * @param milliseconds - Threshold in milliseconds
 * @param sampleRate - Sample rate in Hz
 * @returns Threshold in samples
 */
export function msToSamples(milliseconds: number, sampleRate: number = 44100): number {
  return Math.round((milliseconds * sampleRate) / 1000);
}

/**
 * Create a transient detector instance with cached transients.
 *
 * This class provides a convenient interface for detecting and
 * querying transients with pre-computed results.
 */
export class TransientDetector {
  private transients: number[] = [];
  private config: TransientDetectorConfig;

  constructor(config: Partial<TransientDetectorConfig> = {}) {
    this.config = { ...DEFAULT_TRANSIENT_CONFIG, ...config };
  }

  /**
   * Analyze waveform and cache transient positions.
   */
  analyze(waveformData: WaveformData): void {
    this.transients = detectTransients(waveformData, this.config);
  }

  /**
   * Get all detected transients.
   */
  getTransients(): number[] {
    return this.transients;
  }

  /**
   * Get number of detected transients.
   */
  get count(): number {
    return this.transients.length;
  }

  /**
   * Find nearest transient to a sample position.
   */
  findNearest(samplePosition: number, threshold?: number): TransientSearchResult {
    return findNearestTransient(
      this.transients,
      samplePosition,
      threshold ?? this.config.snapThreshold
    );
  }

  /**
   * Check if a sample position is near a transient.
   */
  isNearTransient(samplePosition: number, threshold?: number): boolean {
    return this.findNearest(samplePosition, threshold).found;
  }

  /**
   * Update snap threshold.
   */
  setSnapThreshold(samples: number): void {
    this.config.snapThreshold = samples;
  }

  /**
   * Clear cached transients.
   */
  clear(): void {
    this.transients = [];
  }
}
