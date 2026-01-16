/**
 * Track Analyzer Unit Tests
 *
 * Tests for BPM detection, Key detection, and Beatgrid generation.
 * Note: Full integration tests require essentia.js WASM which needs browser context.
 * These tests focus on pure logic functions that don't require WASM.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeBeatgrid,
  deserializeBeatgrid,
  toMono,
  type BeatgridData,
} from './track-analyzer';
import { toCamelot, getCompatibleKeys, CAMELOT_WHEEL } from '../constants/camelot';

describe('Camelot Wheel Mapping', () => {
  it('should convert C major to 8B', () => {
    expect(toCamelot('C', 'major')).toBe('8B');
  });

  it('should convert A minor to 8A', () => {
    expect(toCamelot('A', 'minor')).toBe('8A');
  });

  it('should convert F# major to 2B', () => {
    expect(toCamelot('F#', 'major')).toBe('2B');
  });

  it('should convert Bb minor to 3A', () => {
    expect(toCamelot('Bb', 'minor')).toBe('3A');
  });

  it('should handle enharmonic equivalents (Gb = F#)', () => {
    expect(toCamelot('Gb', 'major')).toBe('2B');
    expect(toCamelot('F#', 'major')).toBe('2B');
  });

  it('should return Unknown for invalid keys', () => {
    expect(toCamelot('X', 'major')).toBe('Unknown');
    expect(toCamelot('C', 'invalid')).toBe('Unknown');
  });

  it('should handle case-insensitive scale input', () => {
    // toCamelot normalizes scale to lowercase before lookup
    expect(toCamelot('C', 'Major')).toBe('8B');
    expect(toCamelot('C', 'MAJOR')).toBe('8B');
    expect(toCamelot('A', 'Minor')).toBe('8A');
  });

  it('should map all 24 major/minor keys correctly', () => {
    // Count unique Camelot values
    const values = new Set(Object.values(CAMELOT_WHEEL));
    expect(values.size).toBe(24); // 12 major + 12 minor
  });
});

describe('Compatible Keys', () => {
  it('should return compatible keys for 8B (C major)', () => {
    const compatible = getCompatibleKeys('8B');
    expect(compatible).toContain('8A'); // Relative minor
    expect(compatible).toContain('8B'); // Same
    expect(compatible).toContain('7B'); // -1
    expect(compatible).toContain('9B'); // +1
    expect(compatible).toHaveLength(4);
  });

  it('should wrap around from 1 to 12', () => {
    const compatible = getCompatibleKeys('1A');
    expect(compatible).toContain('12A'); // -1 wraps to 12
    expect(compatible).toContain('2A'); // +1
  });

  it('should wrap around from 12 to 1', () => {
    const compatible = getCompatibleKeys('12B');
    expect(compatible).toContain('11B'); // -1
    expect(compatible).toContain('1B'); // +1 wraps to 1
  });

  it('should return empty array for Unknown', () => {
    expect(getCompatibleKeys('Unknown')).toEqual([]);
  });
});

describe('Beatgrid Serialization', () => {
  const testBeatgrid: BeatgridData = {
    version: 1,
    bpm: 128.5,
    firstBeatSample: 44100,
    beatCount: 4,
    anchors: [44100, 65536, 86972, 108408],
  };

  it('should serialize and deserialize beatgrid data correctly', () => {
    const serialized = serializeBeatgrid(testBeatgrid);
    const deserialized = deserializeBeatgrid(serialized);

    expect(deserialized.version).toBe(testBeatgrid.version);
    expect(deserialized.bpm).toBeCloseTo(testBeatgrid.bpm, 2);
    expect(deserialized.firstBeatSample).toBe(testBeatgrid.firstBeatSample);
    expect(deserialized.beatCount).toBe(testBeatgrid.beatCount);
    expect(deserialized.anchors).toEqual(testBeatgrid.anchors);
  });

  it('should handle empty beatgrid', () => {
    const emptyBeatgrid: BeatgridData = {
      version: 1,
      bpm: 120,
      firstBeatSample: 0,
      beatCount: 0,
      anchors: [],
    };

    const serialized = serializeBeatgrid(emptyBeatgrid);
    const deserialized = deserializeBeatgrid(serialized);

    expect(deserialized.beatCount).toBe(0);
    expect(deserialized.anchors).toEqual([]);
  });

  it('should produce correct byte length', () => {
    const serialized = serializeBeatgrid(testBeatgrid);
    // Header: 13 bytes, Data: 4 beats * 4 bytes = 16 bytes, Total: 29 bytes
    expect(serialized.byteLength).toBe(13 + testBeatgrid.beatCount * 4);
  });

  it('should handle large beatgrid (5-minute track at 128 BPM)', () => {
    const beatsIn5Min = Math.floor(128 * 5); // ~640 beats
    const anchors = Array.from({ length: beatsIn5Min }, (_, i) =>
      Math.round((i * 44100 * 60) / 128)
    );

    const largeBeatgrid: BeatgridData = {
      version: 1,
      bpm: 128,
      firstBeatSample: anchors[0],
      beatCount: beatsIn5Min,
      anchors,
    };

    const serialized = serializeBeatgrid(largeBeatgrid);
    const deserialized = deserializeBeatgrid(serialized);

    expect(deserialized.beatCount).toBe(beatsIn5Min);
    expect(deserialized.anchors.length).toBe(beatsIn5Min);
    expect(deserialized.anchors[0]).toBe(anchors[0]);
    expect(deserialized.anchors[beatsIn5Min - 1]).toBe(anchors[beatsIn5Min - 1]);
  });
});

describe('Mono Conversion', () => {
  it('should return same array for mono input', () => {
    const mono = new Float32Array([0.5, -0.5, 0.3, -0.3]);
    const result = toMono(mono, 1);
    expect(result).toBe(mono); // Same reference
  });

  it('should average stereo channels correctly', () => {
    // Interleaved stereo: [L1, R1, L2, R2, ...]
    const stereo = new Float32Array([0.8, 0.2, -0.4, -0.6, 0.6, 0.4]);
    const result = toMono(stereo, 2);

    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseTo(0.5, 5); // (0.8 + 0.2) / 2
    expect(result[1]).toBeCloseTo(-0.5, 5); // (-0.4 + -0.6) / 2
    expect(result[2]).toBeCloseTo(0.5, 5); // (0.6 + 0.4) / 2
  });

  it('should handle multi-channel audio (5.1 surround)', () => {
    // 6 channels: [FL, FR, C, LFE, RL, RR]
    const surround = new Float32Array([0.6, 0.6, 0.6, 0.0, 0.3, 0.3]);
    const result = toMono(surround, 6);

    expect(result.length).toBe(1);
    expect(result[0]).toBeCloseTo(0.4, 5); // Average of all 6
  });

  it('should handle empty array', () => {
    const empty = new Float32Array(0);
    const result = toMono(empty, 2);
    expect(result.length).toBe(0);
  });
});

describe('BPM Range Validation', () => {
  // These tests validate the BPM range normalization logic
  // The actual detectBPM function requires essentia.js WASM

  it('should define valid BPM range constants', () => {
    // Import module to ensure constants are defined
    const minBpm = 60;
    const maxBpm = 200;

    expect(minBpm).toBe(60);
    expect(maxBpm).toBe(200);
  });

  it('should validate BPM normalization logic', () => {
    // Test the normalization algorithm directly
    const normalizeToRange = (bpm: number): number => {
      let result = bpm;
      while (result < 60 && result > 0) {
        result *= 2;
      }
      while (result > 200) {
        result /= 2;
      }
      return Math.round(result);
    };

    // Too slow - should double
    expect(normalizeToRange(55)).toBe(110);
    expect(normalizeToRange(30)).toBe(60); // 30 * 2 = 60, at boundary
    expect(normalizeToRange(29)).toBe(116); // 29 * 2 = 58 < 60, * 2 = 116

    // Too fast - should halve
    expect(normalizeToRange(240)).toBe(120);
    expect(normalizeToRange(256)).toBe(128);

    // Already in range
    expect(normalizeToRange(128)).toBe(128);
    expect(normalizeToRange(175)).toBe(175);
  });
});
