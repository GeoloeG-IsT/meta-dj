/**
 * Transient Detector Unit Tests
 *
 * Tests for peak detection and nearest transient lookup.
 */

import { describe, it, expect } from 'vitest';
import {
  detectTransients,
  findNearestTransient,
  msToSamples,
  TransientDetector,
  DEFAULT_TRANSIENT_CONFIG,
} from './transient-detector';
import type { WaveformData } from '../analysis/waveform-analyzer';

describe('msToSamples', () => {
  it('should convert 10ms to ~441 samples at 44.1kHz', () => {
    expect(msToSamples(10, 44100)).toBe(441);
  });

  it('should convert 1ms to ~44 samples at 44.1kHz', () => {
    expect(msToSamples(1, 44100)).toBe(44);
  });

  it('should convert 100ms to 4410 samples at 44.1kHz', () => {
    expect(msToSamples(100, 44100)).toBe(4410);
  });

  it('should handle different sample rates', () => {
    expect(msToSamples(10, 48000)).toBe(480);
    expect(msToSamples(10, 96000)).toBe(960);
  });
});

describe('findNearestTransient', () => {
  const transients = [1000, 5000, 10000, 15000, 20000];

  it('should return not found for empty array', () => {
    const result = findNearestTransient([], 5000);
    expect(result.found).toBe(false);
    expect(result.samplePosition).toBeNull();
    expect(result.distance).toBeNull();
    expect(result.index).toBeNull();
  });

  it('should find exact match', () => {
    const result = findNearestTransient(transients, 5000, 100);
    expect(result.found).toBe(true);
    expect(result.samplePosition).toBe(5000);
    expect(result.distance).toBe(0);
    expect(result.index).toBe(1);
  });

  it('should find transient within threshold', () => {
    const result = findNearestTransient(transients, 5050, 100);
    expect(result.found).toBe(true);
    expect(result.samplePosition).toBe(5000);
    expect(result.distance).toBe(50);
    expect(result.index).toBe(1);
  });

  it('should not find transient outside threshold', () => {
    const result = findNearestTransient(transients, 7500, 100);
    expect(result.found).toBe(false);
    // Still returns nearest, just not within threshold
    expect(result.samplePosition).toBe(5000);
    expect(result.distance).toBe(2500);
  });

  it('should handle position before first transient', () => {
    const result = findNearestTransient(transients, 500, 1000);
    expect(result.found).toBe(true);
    expect(result.samplePosition).toBe(1000);
    expect(result.distance).toBe(500);
    expect(result.index).toBe(0);
  });

  it('should handle position after last transient', () => {
    const result = findNearestTransient(transients, 25000, 10000);
    expect(result.found).toBe(true);
    expect(result.samplePosition).toBe(20000);
    expect(result.distance).toBe(5000);
    expect(result.index).toBe(4);
  });

  it('should choose closer transient when between two', () => {
    // Position 7400 is closer to 5000 (2400 away) than 10000 (2600 away)
    const result = findNearestTransient(transients, 7400, 5000);
    expect(result.samplePosition).toBe(5000);
    expect(result.distance).toBe(2400);

    // Position 7600 is closer to 10000 (2400 away) than 5000 (2600 away)
    const result2 = findNearestTransient(transients, 7600, 5000);
    expect(result2.samplePosition).toBe(10000);
    expect(result2.distance).toBe(2400);
  });

  it('should handle single transient', () => {
    const result = findNearestTransient([5000], 5100, 500);
    expect(result.found).toBe(true);
    expect(result.samplePosition).toBe(5000);
    expect(result.distance).toBe(100);
  });
});

describe('detectTransients', () => {
  // Helper to create mock waveform data
  function createMockWaveform(peaks: number[], samplesPerPeak: number = 256): WaveformData {
    return {
      peaks,
      duration: (peaks.length * samplesPerPeak) / 44100,
      samplesPerPeak,
      colorMode: 'rgb',
    };
  }

  it('should return empty array for empty peaks', () => {
    const waveform = createMockWaveform([]);
    const transients = detectTransients(waveform);
    expect(transients).toEqual([]);
  });

  it('should detect peaks above threshold', () => {
    // Create peaks with clear transients at indices 10, 30, 50
    const peaks = new Array(100).fill(0.1);
    peaks[10] = 0.8; // Transient
    peaks[30] = 0.6; // Transient
    peaks[50] = 0.5; // Transient

    const waveform = createMockWaveform(peaks, 256);
    const transients = detectTransients(waveform, { amplitudeThreshold: 0.3 });

    expect(transients.length).toBe(3);
    expect(transients).toContain(10 * 256);
    expect(transients).toContain(30 * 256);
    expect(transients).toContain(50 * 256);
  });

  it('should respect minimum peak distance', () => {
    // Create two peaks very close together
    const peaks = new Array(50).fill(0.1);
    peaks[10] = 0.8;
    peaks[11] = 0.7; // Too close to previous peak

    const waveform = createMockWaveform(peaks, 256);
    const transients = detectTransients(waveform, {
      amplitudeThreshold: 0.3,
      minPeakDistance: 512, // At least 512 samples apart
    });

    // Should only detect the first peak
    expect(transients.length).toBe(1);
    expect(transients[0]).toBe(10 * 256);
  });

  it('should only detect local maxima', () => {
    // Create a peak that's not a local maximum (ascending slope)
    const peaks = [0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.3, 0.1];

    const waveform = createMockWaveform(peaks, 256);
    const transients = detectTransients(waveform, { amplitudeThreshold: 0.3 });

    // Should only detect index 5 (value 0.9) as it's the only local maximum above threshold
    expect(transients.length).toBe(1);
    expect(transients[0]).toBe(5 * 256);
  });
});

describe('TransientDetector class', () => {
  function createMockWaveform(peaks: number[]): WaveformData {
    return {
      peaks,
      duration: (peaks.length * 256) / 44100,
      samplesPerPeak: 256,
      colorMode: 'rgb',
    };
  }

  it('should analyze and cache transients', () => {
    const peaks = new Array(100).fill(0.1);
    peaks[10] = 0.8;
    peaks[30] = 0.6;

    const detector = new TransientDetector();
    detector.analyze(createMockWaveform(peaks));

    expect(detector.count).toBe(2);
    expect(detector.getTransients()).toContain(10 * 256);
    expect(detector.getTransients()).toContain(30 * 256);
  });

  it('should find nearest transient', () => {
    const peaks = new Array(100).fill(0.1);
    peaks[20] = 0.8;

    const detector = new TransientDetector();
    detector.analyze(createMockWaveform(peaks));

    const result = detector.findNearest(20 * 256 + 100, 500);
    expect(result.found).toBe(true);
    expect(result.samplePosition).toBe(20 * 256);
    expect(result.distance).toBe(100);
  });

  it('should check if position is near transient', () => {
    const peaks = new Array(100).fill(0.1);
    peaks[20] = 0.8;

    const detector = new TransientDetector();
    detector.analyze(createMockWaveform(peaks));

    expect(detector.isNearTransient(20 * 256 + 100, 500)).toBe(true);
    expect(detector.isNearTransient(20 * 256 + 1000, 500)).toBe(false);
  });

  it('should allow updating snap threshold', () => {
    const peaks = new Array(100).fill(0.1);
    peaks[20] = 0.8;

    const detector = new TransientDetector();
    detector.analyze(createMockWaveform(peaks));

    // Default threshold
    expect(detector.isNearTransient(20 * 256 + 500)).toBe(false); // 500 > 441 default

    // Update threshold
    detector.setSnapThreshold(600);
    expect(detector.isNearTransient(20 * 256 + 500)).toBe(true);
  });

  it('should clear cached transients', () => {
    const peaks = new Array(100).fill(0.1);
    peaks[20] = 0.8;

    const detector = new TransientDetector();
    detector.analyze(createMockWaveform(peaks));

    expect(detector.count).toBe(1);

    detector.clear();
    expect(detector.count).toBe(0);
    expect(detector.getTransients()).toEqual([]);
  });
});

describe('DEFAULT_TRANSIENT_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_TRANSIENT_CONFIG.amplitudeThreshold).toBe(0.3);
    expect(DEFAULT_TRANSIENT_CONFIG.minPeakDistance).toBe(512);
    expect(DEFAULT_TRANSIENT_CONFIG.snapThreshold).toBe(441); // ~10ms at 44.1kHz
  });
});
