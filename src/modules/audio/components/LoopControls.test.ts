/**
 * LoopControls Unit Tests
 *
 * Tests for loop control UI logic and formatting.
 * Story 2.4: Hot Cue & Loop Management
 */

import { describe, it, expect } from 'vitest';

/**
 * Format loop length for display.
 * Extracted from LoopControls for testing.
 */
function formatLoopLength(beats: number): string {
  if (beats >= 4) {
    const bars = beats / 4;
    return bars === 1 ? '1 bar' : `${bars} bars`;
  } else if (beats >= 1) {
    return beats === 1 ? '1 beat' : `${beats} beats`;
  } else if (beats >= 0.5) {
    return '1/2 beat';
  } else if (beats >= 0.25) {
    return '1/4 beat';
  } else {
    return `${beats.toFixed(2)} beats`;
  }
}

describe('LoopControls formatLoopLength', () => {
  it('should format bars correctly', () => {
    expect(formatLoopLength(4)).toBe('1 bar');
    expect(formatLoopLength(8)).toBe('2 bars');
    expect(formatLoopLength(16)).toBe('4 bars');
    expect(formatLoopLength(32)).toBe('8 bars');
  });

  it('should format beats correctly', () => {
    expect(formatLoopLength(1)).toBe('1 beat');
    expect(formatLoopLength(2)).toBe('2 beats');
    expect(formatLoopLength(3)).toBe('3 beats');
  });

  it('should format fractional beats correctly', () => {
    expect(formatLoopLength(0.5)).toBe('1/2 beat');
    expect(formatLoopLength(0.25)).toBe('1/4 beat');
  });

  it('should format very short loops correctly', () => {
    expect(formatLoopLength(0.125)).toBe('0.13 beats');
    expect(formatLoopLength(0.0625)).toBe('0.06 beats');
  });
});

describe('LoopControls loop length options', () => {
  const LOOP_LENGTHS = [0.25, 0.5, 1, 2, 4, 8, 16];

  it('should have 7 standard loop length options', () => {
    expect(LOOP_LENGTHS).toHaveLength(7);
  });

  it('should include fractional beat options', () => {
    expect(LOOP_LENGTHS).toContain(0.25);
    expect(LOOP_LENGTHS).toContain(0.5);
  });

  it('should include whole beat options', () => {
    expect(LOOP_LENGTHS).toContain(1);
    expect(LOOP_LENGTHS).toContain(2);
  });

  it('should include bar options', () => {
    expect(LOOP_LENGTHS).toContain(4); // 1 bar
    expect(LOOP_LENGTHS).toContain(8); // 2 bars
    expect(LOOP_LENGTHS).toContain(16); // 4 bars
  });

  it('should be in ascending order', () => {
    for (let i = 1; i < LOOP_LENGTHS.length; i++) {
      expect(LOOP_LENGTHS[i]).toBeGreaterThan(LOOP_LENGTHS[i - 1]);
    }
  });
});

describe('LoopControls samples per beat calculation', () => {
  // Calculate samples per beat: (60 / bpm) * sampleRate
  function calculateSamplesPerBeat(bpm: number, sampleRate: number): number {
    return (60 / bpm) * sampleRate;
  }

  it('should calculate samples per beat at 120 BPM', () => {
    const samplesPerBeat = calculateSamplesPerBeat(120, 44100);
    expect(samplesPerBeat).toBe(22050);
  });

  it('should calculate samples per beat at 128 BPM', () => {
    const samplesPerBeat = calculateSamplesPerBeat(128, 44100);
    expect(samplesPerBeat).toBeCloseTo(20671.875, 2);
  });

  it('should calculate samples per beat at 140 BPM', () => {
    const samplesPerBeat = calculateSamplesPerBeat(140, 44100);
    expect(samplesPerBeat).toBeCloseTo(18900, 2);
  });

  it('should handle high sample rates', () => {
    const samplesPerBeat = calculateSamplesPerBeat(120, 48000);
    expect(samplesPerBeat).toBe(24000);
  });
});

describe('LoopControls loop length samples calculation', () => {
  // Calculate loop length in samples
  function calculateLoopSamples(beats: number, samplesPerBeat: number): number {
    return Math.round(beats * samplesPerBeat);
  }

  const samplesPerBeat = 22050; // 120 BPM at 44.1kHz

  it('should calculate 1 beat loop correctly', () => {
    expect(calculateLoopSamples(1, samplesPerBeat)).toBe(22050);
  });

  it('should calculate 4 bar loop correctly', () => {
    // 4 bars = 16 beats
    expect(calculateLoopSamples(16, samplesPerBeat)).toBe(352800);
  });

  it('should calculate 1/4 beat loop correctly', () => {
    expect(calculateLoopSamples(0.25, samplesPerBeat)).toBe(5513); // Rounded
  });

  it('should calculate 1/2 beat loop correctly', () => {
    expect(calculateLoopSamples(0.5, samplesPerBeat)).toBe(11025);
  });
});

describe('LoopControls active loop detection', () => {
  // Helper to check if a beat length matches
  function isCurrentLength(activeLoopBeats: number, targetBeats: number): boolean {
    return Math.abs(activeLoopBeats - targetBeats) < 0.1;
  }

  it('should detect exact match', () => {
    expect(isCurrentLength(4, 4)).toBe(true);
    expect(isCurrentLength(1, 1)).toBe(true);
    expect(isCurrentLength(0.5, 0.5)).toBe(true);
  });

  it('should detect near match within tolerance', () => {
    expect(isCurrentLength(3.95, 4)).toBe(true);
    expect(isCurrentLength(4.05, 4)).toBe(true);
    expect(isCurrentLength(0.99, 1)).toBe(true);
  });

  it('should not match outside tolerance', () => {
    expect(isCurrentLength(3.8, 4)).toBe(false);
    expect(isCurrentLength(4.2, 4)).toBe(false);
    expect(isCurrentLength(2, 4)).toBe(false);
  });
});
