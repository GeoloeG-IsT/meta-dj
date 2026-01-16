/**
 * CueMarkerOverlay Unit Tests
 *
 * Tests for cue marker visibility calculations.
 * Story 2.4: Hot Cue & Loop Management
 */

import { describe, it, expect } from 'vitest';
import { getVisibleCues } from './CueMarkerOverlay';
import type { HotCueData } from '../types/cue-loop';
import { createEmptyHotCues } from '../types/cue-loop';

describe('getVisibleCues', () => {
  const totalSamples = 1000000; // 1 million samples

  // Helper to create a set cue at a position
  function createSetCue(index: number, position: number): HotCueData {
    return {
      index,
      position,
      color: 'green',
      name: `Cue ${index + 1}`,
      isSet: true,
    };
  }

  it('should return empty array when no cues are set', () => {
    const emptyCues = createEmptyHotCues();
    const viewRange = { start: 0, end: 1 };

    const visible = getVisibleCues(emptyCues, viewRange, totalSamples);
    expect(visible).toHaveLength(0);
  });

  it('should return cues within view range', () => {
    const cues = createEmptyHotCues();
    cues[0] = createSetCue(0, 250000); // At 25%
    cues[1] = createSetCue(1, 500000); // At 50%
    cues[2] = createSetCue(2, 750000); // At 75%

    // View range from 20% to 60%
    const viewRange = { start: 0.2, end: 0.6 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(2);
    expect(visible[0].cue.index).toBe(0); // Cue at 25% is visible
    expect(visible[1].cue.index).toBe(1); // Cue at 50% is visible
  });

  it('should exclude cues outside view range', () => {
    const cues = createEmptyHotCues();
    cues[0] = createSetCue(0, 100000); // At 10%
    cues[1] = createSetCue(1, 900000); // At 90%

    // View range from 30% to 70%
    const viewRange = { start: 0.3, end: 0.7 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(0);
  });

  it('should calculate correct normalized positions', () => {
    const cues = createEmptyHotCues();
    cues[0] = createSetCue(0, 400000); // At 40%

    // View range from 20% to 60% (400k samples wide)
    const viewRange = { start: 0.2, end: 0.6 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    // Cue at 40% should be at 50% of the view (200k into a 400k view)
    expect(visible[0].position).toBeCloseTo(0.5, 2);
  });

  it('should include cues at view boundaries', () => {
    const cues = createEmptyHotCues();
    cues[0] = createSetCue(0, 200000); // At 20% (left edge)
    cues[1] = createSetCue(1, 600000); // At 60% (right edge)

    // View range from 20% to 60%
    const viewRange = { start: 0.2, end: 0.6 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(2);
    expect(visible[0].position).toBeCloseTo(0, 2); // Left edge
    expect(visible[1].position).toBeCloseTo(1, 2); // Right edge
  });

  it('should skip unset cues even if in view range', () => {
    const cues = createEmptyHotCues();
    cues[0] = createSetCue(0, 500000);
    // cues[1] through cues[7] are unset (isSet: false)

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].cue.index).toBe(0);
  });

  it('should handle zero total samples', () => {
    const cues = createEmptyHotCues();
    cues[0] = createSetCue(0, 500000);

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleCues(cues, viewRange, 0);

    expect(visible).toHaveLength(0);
  });

  it('should handle very narrow view range', () => {
    const cues = createEmptyHotCues();
    // Place cue exactly at 50%
    cues[0] = createSetCue(0, 500000);

    // Very narrow view centered on cue
    const viewRange = { start: 0.499, end: 0.501 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].position).toBeCloseTo(0.5, 1);
  });

  it('should handle all 8 cues in view', () => {
    const cues = createEmptyHotCues();
    for (let i = 0; i < 8; i++) {
      cues[i] = createSetCue(i, (i + 1) * 100000); // 10%, 20%, ..., 80%
    }

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(8);
    // Verify all indices are present
    const indices = visible.map((v) => v.cue.index);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('should preserve cue color in results', () => {
    const cues = createEmptyHotCues();
    cues[0] = {
      index: 0,
      position: 500000,
      color: 'red',
      name: 'Drop',
      isSet: true,
    };

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleCues(cues, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].cue.color).toBe('red');
    expect(visible[0].cue.name).toBe('Drop');
  });
});
