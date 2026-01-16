/**
 * StemControls Unit Tests
 *
 * Tests for stem control logic and formatting.
 * Story 2.5: Client-Side Stem Separation (WebGPU)
 */

import { describe, it, expect } from 'vitest';
import type { StemState, StemAnalysisStage, StemType } from '../types/stems';
import { createInitialStemState, STEM_COLORS, STEM_LABELS } from '../types/stems';

/**
 * Get human-readable label for analysis stage.
 * Extracted from StemControls for testing.
 */
function getStageLabel(stage: StemAnalysisStage | null): string {
  switch (stage) {
    case 'loading_model':
      return 'Loading model';
    case 'preprocessing':
      return 'Preprocessing';
    case 'inference':
      return 'Separating';
    case 'postprocessing':
      return 'Finalizing';
    default:
      return 'Analyzing';
  }
}

/**
 * Determine effective muted state considering solo.
 * When another stem is soloed, this stem is effectively muted.
 */
function isEffectivelyMuted(
  stemType: StemType,
  muted: Record<StemType, boolean>,
  solo: StemType | null
): boolean {
  const isMuted = muted[stemType];
  const isOtherSoloed = solo !== null && solo !== stemType;
  return isMuted || isOtherSoloed;
}

/**
 * Get keyboard shortcut for a stem type.
 */
function getStemShortcut(stemType: StemType): string {
  const shortcuts: Record<StemType, string> = {
    vocals: 'v',
    drums: 'd',
    bass: 'b',
    other: 'o',
  };
  return shortcuts[stemType];
}

describe('StemControls getStageLabel', () => {
  it('should return correct label for loading_model stage', () => {
    expect(getStageLabel('loading_model')).toBe('Loading model');
  });

  it('should return correct label for preprocessing stage', () => {
    expect(getStageLabel('preprocessing')).toBe('Preprocessing');
  });

  it('should return correct label for inference stage', () => {
    expect(getStageLabel('inference')).toBe('Separating');
  });

  it('should return correct label for postprocessing stage', () => {
    expect(getStageLabel('postprocessing')).toBe('Finalizing');
  });

  it('should return default label for null stage', () => {
    expect(getStageLabel(null)).toBe('Analyzing');
  });
});

describe('StemControls isEffectivelyMuted', () => {
  const defaultMuted: Record<StemType, boolean> = {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  };

  it('should return true when stem is directly muted', () => {
    const muted = { ...defaultMuted, vocals: true };
    expect(isEffectivelyMuted('vocals', muted, null)).toBe(true);
  });

  it('should return false when stem is not muted and nothing is soloed', () => {
    expect(isEffectivelyMuted('vocals', defaultMuted, null)).toBe(false);
  });

  it('should return true when another stem is soloed', () => {
    // drums is soloed, so vocals should be effectively muted
    expect(isEffectivelyMuted('vocals', defaultMuted, 'drums')).toBe(true);
  });

  it('should return false when this stem is soloed', () => {
    // vocals is soloed, so vocals should NOT be effectively muted
    expect(isEffectivelyMuted('vocals', defaultMuted, 'vocals')).toBe(false);
  });

  it('should return true when both muted and another stem is soloed', () => {
    const muted = { ...defaultMuted, vocals: true };
    expect(isEffectivelyMuted('vocals', muted, 'drums')).toBe(true);
  });
});

describe('StemControls getStemShortcut', () => {
  it('should return v for vocals', () => {
    expect(getStemShortcut('vocals')).toBe('v');
  });

  it('should return d for drums', () => {
    expect(getStemShortcut('drums')).toBe('d');
  });

  it('should return b for bass', () => {
    expect(getStemShortcut('bass')).toBe('b');
  });

  it('should return o for other', () => {
    expect(getStemShortcut('other')).toBe('o');
  });
});

describe('StemControls createInitialStemState', () => {
  it('should create state with stems not available', () => {
    const state = createInitialStemState();
    expect(state.available).toBe(false);
  });

  it('should create state with all stems unmuted', () => {
    const state = createInitialStemState();
    expect(state.muted.vocals).toBe(false);
    expect(state.muted.drums).toBe(false);
    expect(state.muted.bass).toBe(false);
    expect(state.muted.other).toBe(false);
  });

  it('should create state with no stem soloed', () => {
    const state = createInitialStemState();
    expect(state.solo).toBeNull();
  });

  it('should create state with zero progress', () => {
    const state = createInitialStemState();
    expect(state.progress).toBe(0);
  });

  it('should create state with null buffers', () => {
    const state = createInitialStemState();
    expect(state.buffers.vocals).toBeNull();
    expect(state.buffers.drums).toBeNull();
    expect(state.buffers.bass).toBeNull();
    expect(state.buffers.other).toBeNull();
  });
});

describe('STEM_COLORS', () => {
  it('should have cyan color for vocals', () => {
    expect(STEM_COLORS.vocals).toBe('#5AC8FA');
  });

  it('should have orange color for drums', () => {
    expect(STEM_COLORS.drums).toBe('#FF9500');
  });

  it('should have purple color for bass', () => {
    expect(STEM_COLORS.bass).toBe('#AF52DE');
  });

  it('should have green color for other', () => {
    expect(STEM_COLORS.other).toBe('#4DFA90');
  });
});

describe('STEM_LABELS', () => {
  it('should have VOX label for vocals', () => {
    expect(STEM_LABELS.vocals).toBe('VOX');
  });

  it('should have DRM label for drums', () => {
    expect(STEM_LABELS.drums).toBe('DRM');
  });

  it('should have BAS label for bass', () => {
    expect(STEM_LABELS.bass).toBe('BAS');
  });

  it('should have OTH label for other', () => {
    expect(STEM_LABELS.other).toBe('OTH');
  });
});
