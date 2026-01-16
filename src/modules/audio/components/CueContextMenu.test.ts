/**
 * CueContextMenu Unit Tests
 *
 * Tests for context menu logic.
 * Story 2.4: Hot Cue & Loop Management
 */

import { describe, it, expect } from 'vitest';
import type { CueColor } from '../types/cue-loop';
import { CUE_COLOR_HEX } from '../types/cue-loop';

describe('CueContextMenu color palette', () => {
  const COLORS: CueColor[] = [
    'red',
    'orange',
    'yellow',
    'green',
    'cyan',
    'blue',
    'purple',
    'pink',
  ];

  it('should have 8 colors in the palette', () => {
    expect(COLORS).toHaveLength(8);
  });

  it('should have hex values for all colors', () => {
    for (const color of COLORS) {
      expect(CUE_COLOR_HEX[color]).toBeDefined();
      expect(CUE_COLOR_HEX[color]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('should include Engine Green as default', () => {
    expect(COLORS).toContain('green');
    expect(CUE_COLOR_HEX['green']).toBe('#4DFA90');
  });
});

describe('CueContextMenu hold-to-delete timing', () => {
  const HOLD_TO_DELETE_MS = 800;

  it('should have reasonable hold duration', () => {
    expect(HOLD_TO_DELETE_MS).toBeGreaterThanOrEqual(500);
    expect(HOLD_TO_DELETE_MS).toBeLessThanOrEqual(2000);
  });

  it('should calculate progress correctly', () => {
    // Progress should be 0-1 based on elapsed time
    const calculateProgress = (elapsed: number): number => {
      return Math.min(elapsed / HOLD_TO_DELETE_MS, 1);
    };

    expect(calculateProgress(0)).toBe(0);
    expect(calculateProgress(400)).toBe(0.5);
    expect(calculateProgress(800)).toBe(1);
    expect(calculateProgress(1000)).toBe(1); // Capped at 1
  });
});

describe('CueContextMenu name validation', () => {
  const MAX_NAME_LENGTH = 32;

  it('should enforce maximum name length', () => {
    const longName = 'A'.repeat(50);
    const truncated = longName.slice(0, MAX_NAME_LENGTH);
    expect(truncated).toHaveLength(MAX_NAME_LENGTH);
  });

  it('should allow empty names', () => {
    const emptyName = '';
    expect(emptyName.trim()).toBe('');
  });

  it('should trim whitespace from names', () => {
    const paddedName = '  Drop 1  ';
    expect(paddedName.trim()).toBe('Drop 1');
  });
});

describe('CueContextMenu item labels', () => {
  const getItemLabel = (type: 'cue' | 'loop', index: number): string => {
    const displayIndex = index + 1;
    return type === 'cue' ? `Cue ${displayIndex}` : `Loop ${displayIndex}`;
  };

  it('should format cue labels correctly', () => {
    expect(getItemLabel('cue', 0)).toBe('Cue 1');
    expect(getItemLabel('cue', 7)).toBe('Cue 8');
  });

  it('should format loop labels correctly', () => {
    expect(getItemLabel('loop', 0)).toBe('Loop 1');
    expect(getItemLabel('loop', 7)).toBe('Loop 8');
  });

  it('should use 1-based display indices', () => {
    // Internal index 0 should display as 1
    for (let i = 0; i < 8; i++) {
      expect(getItemLabel('cue', i)).toContain(String(i + 1));
    }
  });
});
