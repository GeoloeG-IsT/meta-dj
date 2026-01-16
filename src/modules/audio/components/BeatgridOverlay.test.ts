/**
 * BeatgridOverlay Unit Tests
 *
 * Tests for beat position calculation and visibility logic.
 */

import { describe, it, expect } from 'vitest';
import { getVisibleBeats } from './BeatgridOverlay';
import type { BeatgridData } from '../analysis/track-analyzer';

describe('getVisibleBeats', () => {
  // Sample rate for calculations (44.1kHz)
  const SAMPLE_RATE = 44100;

  // Create a standard beatgrid at 120 BPM (2 beats per second)
  const createTestBeatgrid = (beatCount: number, bpm: number = 120): BeatgridData => {
    const samplesPerBeat = Math.round((SAMPLE_RATE * 60) / bpm);
    const anchors = Array.from({ length: beatCount }, (_, i) => i * samplesPerBeat);
    return {
      version: 1,
      bpm,
      firstBeatSample: 0,
      beatCount,
      anchors,
    };
  };

  it('should return empty array when beatgrid is empty', () => {
    const emptyBeatgrid: BeatgridData = {
      version: 1,
      bpm: 120,
      firstBeatSample: 0,
      beatCount: 0,
      anchors: [],
    };

    const result = getVisibleBeats(emptyBeatgrid, { start: 0, end: 1 }, 1000000);
    expect(result).toEqual([]);
  });

  it('should return empty array when totalSamples is zero', () => {
    const beatgrid = createTestBeatgrid(16);
    const result = getVisibleBeats(beatgrid, { start: 0, end: 1 }, 0);
    expect(result).toEqual([]);
  });

  it('should return all beats when viewing full track', () => {
    const beatgrid = createTestBeatgrid(16);
    const totalSamples = beatgrid.anchors[beatgrid.anchors.length - 1] + 1000;

    const result = getVisibleBeats(beatgrid, { start: 0, end: 1 }, totalSamples);

    expect(result.length).toBe(16);
    expect(result[0].index).toBe(0);
    expect(result[15].index).toBe(15);
  });

  it('should filter beats outside view range', () => {
    const beatgrid = createTestBeatgrid(100);
    const totalSamples = beatgrid.anchors[99] + 1000;

    // View only 10-20% of track
    const result = getVisibleBeats(beatgrid, { start: 0.1, end: 0.2 }, totalSamples);

    // Should only include beats in that range
    result.forEach((beat) => {
      const normalizedPosition = beat.samplePosition / totalSamples;
      expect(normalizedPosition).toBeGreaterThanOrEqual(0.1);
      expect(normalizedPosition).toBeLessThanOrEqual(0.2);
    });
  });

  it('should correctly identify downbeats (every 4th beat)', () => {
    const beatgrid = createTestBeatgrid(16);
    const totalSamples = beatgrid.anchors[15] + 1000;

    const result = getVisibleBeats(beatgrid, { start: 0, end: 1 }, totalSamples);

    // Beat 0, 4, 8, 12 should be downbeats
    expect(result[0].isDownbeat).toBe(true);
    expect(result[1].isDownbeat).toBe(false);
    expect(result[2].isDownbeat).toBe(false);
    expect(result[3].isDownbeat).toBe(false);
    expect(result[4].isDownbeat).toBe(true);
    expect(result[8].isDownbeat).toBe(true);
    expect(result[12].isDownbeat).toBe(true);
  });

  it('should calculate correct normalized positions within view', () => {
    const beatgrid = createTestBeatgrid(4);
    const totalSamples = beatgrid.anchors[3] + 1000;

    const result = getVisibleBeats(beatgrid, { start: 0, end: 1 }, totalSamples);

    // First beat should be near the left edge
    expect(result[0].position).toBeCloseTo(0, 1);

    // Positions should be in ascending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i].position).toBeGreaterThan(result[i - 1].position);
    }
  });

  it('should apply slip offset to beat positions', () => {
    const beatgrid = createTestBeatgrid(8);
    const totalSamples = beatgrid.anchors[7] + 10000;
    const slipOffset = 1000; // Shift beats forward by 1000 samples

    const withoutOffset = getVisibleBeats(beatgrid, { start: 0, end: 1 }, totalSamples, 0);
    const withOffset = getVisibleBeats(beatgrid, { start: 0, end: 1 }, totalSamples, slipOffset);

    // Same number of beats should be visible
    expect(withOffset.length).toBe(withoutOffset.length);

    // Each beat should be shifted by the offset
    withOffset.forEach((beat, i) => {
      expect(beat.samplePosition).toBe(withoutOffset[i].samplePosition + slipOffset);
    });
  });

  it('should handle negative slip offset', () => {
    const beatgrid = createTestBeatgrid(8);
    const totalSamples = beatgrid.anchors[7] + 10000;
    const slipOffset = -500; // Shift beats backward by 500 samples

    const result = getVisibleBeats(beatgrid, { start: 0, end: 1 }, totalSamples, slipOffset);

    // First beat would be at -500 samples, which might be outside view start
    // depending on view range
    result.forEach((beat) => {
      expect(beat.samplePosition).toBe(beatgrid.anchors[beat.index] + slipOffset);
    });
  });

  it('should exclude beats shifted outside view by slip offset', () => {
    const beatgrid = createTestBeatgrid(8);
    const totalSamples = beatgrid.anchors[7] + 10000;

    // View only middle portion
    const viewRange = { start: 0.3, end: 0.7 };

    // Apply large positive offset that pushes some beats out of view
    const largeOffset = Math.round(totalSamples * 0.3);
    const beatsWithOffset = getVisibleBeats(beatgrid, viewRange, totalSamples, largeOffset);

    // With positive offset, beats shift right, so some may exit the view on the right
    // and some that were to the left may enter
    beatsWithOffset.forEach((beat) => {
      const samplePos = beat.samplePosition;
      expect(samplePos).toBeGreaterThanOrEqual(viewRange.start * totalSamples);
      expect(samplePos).toBeLessThanOrEqual(viewRange.end * totalSamples);
    });
  });

  it('should handle partial view at track boundaries', () => {
    const beatgrid = createTestBeatgrid(100);
    const totalSamples = beatgrid.anchors[99] + 1000;

    // View start of track
    const startResult = getVisibleBeats(beatgrid, { start: 0, end: 0.1 }, totalSamples);
    expect(startResult[0].index).toBe(0);

    // View end of track
    const endResult = getVisibleBeats(beatgrid, { start: 0.9, end: 1 }, totalSamples);
    expect(endResult[endResult.length - 1].index).toBe(99);
  });
});

describe('BeatgridOverlay position calculations', () => {
  it('should calculate beat positions correctly for different BPMs', () => {
    const SAMPLE_RATE = 44100;

    // At 120 BPM: 0.5 seconds per beat = 22050 samples
    const bpm120 = 120;
    const samplesPerBeat120 = (SAMPLE_RATE * 60) / bpm120;
    expect(samplesPerBeat120).toBe(22050);

    // At 128 BPM: ~0.469 seconds per beat = ~20672 samples
    const bpm128 = 128;
    const samplesPerBeat128 = (SAMPLE_RATE * 60) / bpm128;
    expect(samplesPerBeat128).toBeCloseTo(20671.875, 1);

    // At 140 BPM: ~0.429 seconds per beat = ~18900 samples
    const bpm140 = 140;
    const samplesPerBeat140 = (SAMPLE_RATE * 60) / bpm140;
    expect(samplesPerBeat140).toBeCloseTo(18900, 1);
  });
});
