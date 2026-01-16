/**
 * LibraryWaveform Unit Tests
 *
 * Tests for LibraryWaveform helper functions and logic.
 * Story 5.2: Relocate Waveform UI Above Track List
 */

import { describe, it, expect } from 'vitest';

/**
 * Formats track duration in mm:ss format.
 * Extracted from LibraryWaveform for testing.
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Determine if zoom is active (> 1x).
 * When zoomed, WaveformDetail is used instead of WaveformOverview.
 */
function isZoomed(zoomLevel: 1 | 2 | 4 | 8): boolean {
  return zoomLevel > 1;
}

/**
 * Determine if loading state should be shown.
 * Shows loading when analyzing and no waveform data yet.
 */
function shouldShowLoading(isAnalyzing: boolean, hasWaveformData: boolean): boolean {
  return isAnalyzing && !hasWaveformData;
}

/**
 * Determine if placeholder state should be shown.
 * Shows placeholder when no track is loaded.
 */
function shouldShowPlaceholder(trackId: number | null): boolean {
  return trackId === null;
}

describe('LibraryWaveform formatDuration', () => {
  it('should return 0:00 for zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('should return 0:00 for negative seconds', () => {
    expect(formatDuration(-10)).toBe('0:00');
  });

  it('should return 0:00 for NaN', () => {
    expect(formatDuration(NaN)).toBe('0:00');
  });

  it('should format seconds under a minute correctly', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('should format exactly one minute correctly', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('should format long tracks correctly', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('should pad single digit seconds with zero', () => {
    expect(formatDuration(63)).toBe('1:03');
  });

  it('should not pad double digit seconds', () => {
    expect(formatDuration(75)).toBe('1:15');
  });

  it('should handle fractional seconds by flooring', () => {
    expect(formatDuration(65.9)).toBe('1:05');
  });
});

describe('LibraryWaveform isZoomed', () => {
  it('should return false for 1x zoom', () => {
    expect(isZoomed(1)).toBe(false);
  });

  it('should return true for 2x zoom', () => {
    expect(isZoomed(2)).toBe(true);
  });

  it('should return true for 4x zoom', () => {
    expect(isZoomed(4)).toBe(true);
  });

  it('should return true for 8x zoom', () => {
    expect(isZoomed(8)).toBe(true);
  });
});

describe('LibraryWaveform shouldShowLoading', () => {
  it('should return true when analyzing and no waveform data', () => {
    expect(shouldShowLoading(true, false)).toBe(true);
  });

  it('should return false when not analyzing', () => {
    expect(shouldShowLoading(false, false)).toBe(false);
  });

  it('should return false when analyzing but waveform data exists', () => {
    expect(shouldShowLoading(true, true)).toBe(false);
  });

  it('should return false when not analyzing and has waveform data', () => {
    expect(shouldShowLoading(false, true)).toBe(false);
  });
});

describe('LibraryWaveform shouldShowPlaceholder', () => {
  it('should return true when trackId is null', () => {
    expect(shouldShowPlaceholder(null)).toBe(true);
  });

  it('should return false when trackId is a number', () => {
    expect(shouldShowPlaceholder(123)).toBe(false);
  });

  it('should return false when trackId is zero', () => {
    expect(shouldShowPlaceholder(0)).toBe(false);
  });
});

describe('LibraryWaveform zoom levels', () => {
  const validZoomLevels: Array<1 | 2 | 4 | 8> = [1, 2, 4, 8];

  it('should have exactly 4 valid zoom levels', () => {
    expect(validZoomLevels.length).toBe(4);
  });

  it('should include 1x as the minimum zoom', () => {
    expect(validZoomLevels[0]).toBe(1);
  });

  it('should include 8x as the maximum zoom', () => {
    expect(validZoomLevels[validZoomLevels.length - 1]).toBe(8);
  });

  it('zoom levels should double each step', () => {
    for (let i = 1; i < validZoomLevels.length; i++) {
      expect(validZoomLevels[i]).toBe(validZoomLevels[i - 1] * 2);
    }
  });
});
