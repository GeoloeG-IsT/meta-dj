/**
 * LoopRegionOverlay Unit Tests
 *
 * Tests for loop region visibility calculations.
 * Story 2.4: Hot Cue & Loop Management
 */

import { describe, it, expect } from 'vitest';
import { getVisibleLoops } from './LoopRegionOverlay';
import type { LoopData } from '../types/cue-loop';

describe('getVisibleLoops', () => {
  const totalSamples = 1000000; // 1 million samples

  // Helper to create a loop
  function createLoop(
    index: number,
    inPoint: number,
    outPoint: number,
    isActive = false
  ): LoopData {
    return {
      index,
      inPoint,
      outPoint,
      color: 'green',
      name: `Loop ${index + 1}`,
      isActive,
    };
  }

  it('should return empty array when no loops exist', () => {
    const loops: LoopData[] = [];
    const viewRange = { start: 0, end: 1 };

    const visible = getVisibleLoops(loops, viewRange, totalSamples);
    expect(visible).toHaveLength(0);
  });

  it('should return loops within view range', () => {
    const loops = [
      createLoop(0, 200000, 400000), // 20%-40%
      createLoop(1, 500000, 700000), // 50%-70%
    ];

    // View range from 30% to 60%
    const viewRange = { start: 0.3, end: 0.6 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(2);
    // First loop overlaps (40% end is within view)
    expect(visible[0].loop.index).toBe(0);
    // Second loop overlaps (50% start is within view)
    expect(visible[1].loop.index).toBe(1);
  });

  it('should exclude loops entirely outside view range', () => {
    const loops = [
      createLoop(0, 100000, 200000), // 10%-20%
      createLoop(1, 800000, 900000), // 80%-90%
    ];

    // View range from 40% to 60%
    const viewRange = { start: 0.4, end: 0.6 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(0);
  });

  it('should calculate correct normalized positions', () => {
    const loops = [
      createLoop(0, 300000, 500000), // 30%-50%
    ];

    // View range from 20% to 60% (400k samples wide)
    const viewRange = { start: 0.2, end: 0.6 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    // In-point at 30% is at 25% of view ((300k-200k)/400k = 0.25)
    expect(visible[0].startPosition).toBeCloseTo(0.25, 2);
    // Out-point at 50% is at 75% of view ((500k-200k)/400k = 0.75)
    expect(visible[0].endPosition).toBeCloseTo(0.75, 2);
  });

  it('should clamp visible positions to 0-1 range', () => {
    const loops = [
      createLoop(0, 100000, 600000), // 10%-60%, extends before view start
    ];

    // View range from 30% to 50%
    const viewRange = { start: 0.3, end: 0.5 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    // Start position is negative (before view) so clamped to 0
    expect(visible[0].startPosition).toBeLessThan(0);
    expect(visible[0].visibleStart).toBe(0);
    // End position extends past view so clamped to 1
    expect(visible[0].endPosition).toBeGreaterThan(1);
    expect(visible[0].visibleEnd).toBe(1);
  });

  it('should handle loop spanning entire view', () => {
    const loops = [
      createLoop(0, 0, 1000000), // Entire track
    ];

    const viewRange = { start: 0.3, end: 0.7 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].visibleStart).toBe(0);
    expect(visible[0].visibleEnd).toBe(1);
  });

  it('should handle loop exactly at view boundaries', () => {
    const loops = [
      createLoop(0, 200000, 400000), // 20%-40%
    ];

    // View range exactly matching loop boundaries
    const viewRange = { start: 0.2, end: 0.4 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].visibleStart).toBeCloseTo(0, 2);
    expect(visible[0].visibleEnd).toBeCloseTo(1, 2);
  });

  it('should handle zero total samples', () => {
    const loops = [createLoop(0, 200000, 400000)];

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleLoops(loops, viewRange, 0);

    expect(visible).toHaveLength(0);
  });

  it('should handle multiple overlapping loops', () => {
    const loops = [
      createLoop(0, 200000, 500000), // 20%-50%
      createLoop(1, 300000, 600000), // 30%-60% (overlaps with first)
      createLoop(2, 400000, 700000), // 40%-70% (overlaps with both)
    ];

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(3);
    expect(visible[0].loop.index).toBe(0);
    expect(visible[1].loop.index).toBe(1);
    expect(visible[2].loop.index).toBe(2);
  });

  it('should preserve loop active state in results', () => {
    const loops = [
      createLoop(0, 200000, 400000, true), // Active
    ];

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].loop.isActive).toBe(true);
  });

  it('should preserve loop color and name in results', () => {
    const loops: LoopData[] = [
      {
        index: 0,
        inPoint: 200000,
        outPoint: 400000,
        color: 'red',
        name: 'Verse Loop',
        isActive: false,
      },
    ];

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].loop.color).toBe('red');
    expect(visible[0].loop.name).toBe('Verse Loop');
  });

  it('should handle very narrow loops', () => {
    const loops = [
      createLoop(0, 500000, 500100), // Very short loop
    ];

    const viewRange = { start: 0, end: 1 };
    const visible = getVisibleLoops(loops, viewRange, totalSamples);

    expect(visible).toHaveLength(1);
    expect(visible[0].visibleEnd - visible[0].visibleStart).toBeCloseTo(0.0001, 4);
  });
});
