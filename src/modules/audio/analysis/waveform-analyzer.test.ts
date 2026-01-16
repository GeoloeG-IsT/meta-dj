import { describe, it, expect, beforeEach } from 'vitest';
import {
  WaveformAnalyzer,
  type WaveformOptions,
  FREQUENCY_BANDS,
} from './waveform-analyzer';

describe('WaveformAnalyzer', () => {
  describe('frequency band definitions', () => {
    it('should define correct crossover frequencies', () => {
      expect(FREQUENCY_BANDS.LOW.min).toBe(20);
      expect(FREQUENCY_BANDS.LOW.max).toBe(250);
      expect(FREQUENCY_BANDS.MID.min).toBe(250);
      expect(FREQUENCY_BANDS.MID.max).toBe(4000);
      expect(FREQUENCY_BANDS.HIGH.min).toBe(4000);
      expect(FREQUENCY_BANDS.HIGH.max).toBe(20000);
    });
  });

  describe('analyzeBuffer', () => {
    let analyzer: WaveformAnalyzer;

    beforeEach(() => {
      analyzer = new WaveformAnalyzer();
    });

    it('should return WaveformData with correct structure', () => {
      // Create a simple test audio buffer (1 second of silence at 44100Hz)
      const sampleRate = 44100;
      const duration = 1; // 1 second
      const samples = new Float32Array(sampleRate * duration);

      const result = analyzer.analyzeBuffer(samples, sampleRate);

      expect(result).toHaveProperty('low');
      expect(result).toHaveProperty('mid');
      expect(result).toHaveProperty('high');
      expect(result).toHaveProperty('sampleRate');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('pointsPerSecond');
    });

    it('should generate correct number of data points based on decimation', () => {
      const sampleRate = 44100;
      const duration = 60; // 60 seconds
      const samples = new Float32Array(sampleRate * duration);

      // Default is ~1000 points per minute = ~16.67 points per second
      const result = analyzer.analyzeBuffer(samples, sampleRate);

      // Should be approximately 1000 points for 60 seconds
      expect(result.low.length).toBeGreaterThanOrEqual(900);
      expect(result.low.length).toBeLessThanOrEqual(1100);
      expect(result.mid.length).toBe(result.low.length);
      expect(result.high.length).toBe(result.low.length);
    });

    it('should normalize peaks to 0-1 range', () => {
      const sampleRate = 44100;
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);

      // Fill with random audio-like data
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.1) * 0.8; // Sine wave
      }

      const result = analyzer.analyzeBuffer(samples, sampleRate);

      // All values should be between 0 and 1
      result.low.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
      result.mid.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
      result.high.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
    });

    it('should detect bass frequencies in low band', () => {
      const sampleRate = 44100;
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);

      // Generate a 100Hz sine wave (bass frequency)
      const bassFreq = 100;
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * bassFreq * i / sampleRate) * 0.9;
      }

      const result = analyzer.analyzeBuffer(samples, sampleRate);

      // Low band should have significant energy
      const avgLow = result.low.reduce((a, b) => a + b, 0) / result.low.length;
      const avgMid = result.mid.reduce((a, b) => a + b, 0) / result.mid.length;
      const avgHigh = result.high.reduce((a, b) => a + b, 0) / result.high.length;

      // Bass should be predominantly in low band
      expect(avgLow).toBeGreaterThan(avgMid);
      expect(avgLow).toBeGreaterThan(avgHigh);
    });

    it('should detect high frequencies in high band', () => {
      const sampleRate = 44100;
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);

      // Generate a 8000Hz sine wave (high frequency)
      const highFreq = 8000;
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * highFreq * i / sampleRate) * 0.9;
      }

      const result = analyzer.analyzeBuffer(samples, sampleRate);

      // High band should have significant energy
      const avgLow = result.low.reduce((a, b) => a + b, 0) / result.low.length;
      const avgHigh = result.high.reduce((a, b) => a + b, 0) / result.high.length;

      // High frequency should be predominantly in high band
      expect(avgHigh).toBeGreaterThan(avgLow);
    });

    it('should detect mid frequencies in mid band', () => {
      const sampleRate = 44100;
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);

      // Generate a 1000Hz sine wave (mid frequency, well within 250-4000Hz range)
      const midFreq = 1000;
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * midFreq * i / sampleRate) * 0.9;
      }

      const result = analyzer.analyzeBuffer(samples, sampleRate);

      // Mid band should have significant energy
      const avgLow = result.low.reduce((a, b) => a + b, 0) / result.low.length;
      const avgMid = result.mid.reduce((a, b) => a + b, 0) / result.mid.length;
      const avgHigh = result.high.reduce((a, b) => a + b, 0) / result.high.length;

      // Mid frequency should be predominantly in mid band
      expect(avgMid).toBeGreaterThan(avgLow);
      expect(avgMid).toBeGreaterThan(avgHigh);
    });

    it('should handle custom options', () => {
      const sampleRate = 44100;
      const duration = 10;
      const samples = new Float32Array(sampleRate * duration);

      const options: WaveformOptions = {
        pointsPerMinute: 2000, // Higher resolution
        fftSize: 4096,
      };

      const result = analyzer.analyzeBuffer(samples, sampleRate, options);

      // Should have approximately 333 points for 10 seconds at 2000 PPM
      expect(result.low.length).toBeGreaterThanOrEqual(280);
      expect(result.low.length).toBeLessThanOrEqual(400);
    });
  });

  describe('serializeWaveformData', () => {
    let analyzer: WaveformAnalyzer;

    beforeEach(() => {
      analyzer = new WaveformAnalyzer();
    });

    it('should serialize waveform data to Uint8Array', () => {
      const sampleRate = 44100;
      const samples = new Float32Array(sampleRate * 5); // 5 seconds

      const waveformData = analyzer.analyzeBuffer(samples, sampleRate);
      const serialized = analyzer.serializeWaveformData(waveformData);

      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBeGreaterThan(0);
    });

    it('should be deserializable back to original data', () => {
      const sampleRate = 44100;
      const samples = new Float32Array(sampleRate * 5);

      // Generate some test data
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01) * 0.5;
      }

      const original = analyzer.analyzeBuffer(samples, sampleRate);
      const serialized = analyzer.serializeWaveformData(original);
      const deserialized = analyzer.deserializeWaveformData(serialized);

      expect(deserialized.sampleRate).toBeCloseTo(original.sampleRate, 2);
      expect(deserialized.duration).toBeCloseTo(original.duration, 2);
      expect(deserialized.pointsPerSecond).toBeCloseTo(original.pointsPerSecond, 2);
      expect(deserialized.low.length).toBe(original.low.length);
      expect(deserialized.mid.length).toBe(original.mid.length);
      expect(deserialized.high.length).toBe(original.high.length);

      // Check values are approximately equal (within float precision)
      for (let i = 0; i < original.low.length; i++) {
        expect(deserialized.low[i]).toBeCloseTo(original.low[i], 2);
        expect(deserialized.mid[i]).toBeCloseTo(original.mid[i], 2);
        expect(deserialized.high[i]).toBeCloseTo(original.high[i], 2);
      }
    });
  });

  describe('getFrequencyBinIndices', () => {
    let analyzer: WaveformAnalyzer;

    beforeEach(() => {
      analyzer = new WaveformAnalyzer();
    });

    it('should calculate correct bin indices for sample rate', () => {
      const sampleRate = 44100;
      const fftSize = 2048;

      const indices = analyzer.getFrequencyBinIndices(sampleRate, fftSize);

      // Each bin covers sampleRate / fftSize Hz
      const binWidth = sampleRate / fftSize; // ~21.5 Hz per bin

      // Low band: 20-250Hz
      expect(indices.lowStart).toBe(Math.floor(20 / binWidth));
      expect(indices.lowEnd).toBe(Math.floor(250 / binWidth));

      // Mid band: 250-4000Hz
      expect(indices.midStart).toBe(Math.floor(250 / binWidth));
      expect(indices.midEnd).toBe(Math.floor(4000 / binWidth));

      // High band: 4000-20000Hz (capped at Nyquist)
      expect(indices.highStart).toBe(Math.floor(4000 / binWidth));
      // Should not exceed fftSize/2
      expect(indices.highEnd).toBeLessThanOrEqual(fftSize / 2);
    });
  });
});
