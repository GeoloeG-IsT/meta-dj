/**
 * Cue & Loop Type Tests
 *
 * Tests for hot cue and loop serialization/deserialization.
 * Story 2.4: Hot Cue & Loop Management
 */

import { describe, it, expect } from 'vitest';
import {
  serializeHotCue,
  deserializeHotCue,
  serializeLoop,
  deserializeLoop,
  createEmptyHotCue,
  createEmptyHotCues,
  calculateLoopLengthLabel,
  CUE_COLOR_INDEX,
  INDEX_TO_CUE_COLOR,
  CUE_COLOR_HEX,
  DEFAULT_CUE_COLOR,
  type HotCueData,
  type LoopData,
} from './cue-loop';

describe('Hot Cue Serialization', () => {
  const testCue: HotCueData = {
    index: 0,
    position: 44100,
    color: 'green',
    name: 'Drop',
    isSet: true,
  };

  it('should serialize and deserialize hot cue data correctly', () => {
    const serialized = serializeHotCue(testCue);
    const deserialized = deserializeHotCue(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.index).toBe(testCue.index);
    expect(deserialized!.position).toBe(testCue.position);
    expect(deserialized!.color).toBe(testCue.color);
    expect(deserialized!.name).toBe(testCue.name);
    expect(deserialized!.isSet).toBe(true);
  });

  it('should handle all 8 color values', () => {
    const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const;

    for (const color of colors) {
      const cue: HotCueData = { ...testCue, color };
      const serialized = serializeHotCue(cue);
      const deserialized = deserializeHotCue(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.color).toBe(color);
    }
  });

  it('should handle empty name', () => {
    const cue: HotCueData = { ...testCue, name: '' };
    const serialized = serializeHotCue(cue);
    const deserialized = deserializeHotCue(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.name).toBe('');
  });

  it('should handle unicode names', () => {
    const cue: HotCueData = { ...testCue, name: '🎵 Drop 1 🔥' };
    const serialized = serializeHotCue(cue);
    const deserialized = deserializeHotCue(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.name).toBe('🎵 Drop 1 🔥');
  });

  it('should handle all 8 pad indices', () => {
    for (let i = 0; i < 8; i++) {
      const cue: HotCueData = { ...testCue, index: i };
      const serialized = serializeHotCue(cue);
      const deserialized = deserializeHotCue(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.index).toBe(i);
    }
  });

  it('should handle large sample positions', () => {
    // 10-minute track at 44.1kHz = 26,460,000 samples
    const cue: HotCueData = { ...testCue, position: 26460000 };
    const serialized = serializeHotCue(cue);
    const deserialized = deserializeHotCue(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.position).toBe(26460000);
  });

  it('should deserialize ArrayBuffer input', () => {
    const serialized = serializeHotCue(testCue);
    // Use Uint8Array to create a clean ArrayBuffer copy
    const arrayBuffer = new Uint8Array(serialized).buffer as ArrayBuffer;
    const deserialized = deserializeHotCue(arrayBuffer);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.index).toBe(testCue.index);
  });

  it('should deserialize array input', () => {
    const serialized = serializeHotCue(testCue);
    const array = Array.from(serialized);
    const deserialized = deserializeHotCue(array);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.index).toBe(testCue.index);
  });

  it('should return null for invalid data', () => {
    const invalidData = new Uint8Array([0, 1, 2, 3]);
    const deserialized = deserializeHotCue(invalidData);
    expect(deserialized).toBeNull();
  });

  it('should use default color for invalid color index', () => {
    // Manually create invalid JSON with out-of-range color index
    const invalidJson = JSON.stringify({
      index: 0,
      position: 44100,
      colorIndex: 99, // Invalid
      name: 'Test',
    });
    const encoded = new TextEncoder().encode(invalidJson);
    const deserialized = deserializeHotCue(encoded);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.color).toBe(DEFAULT_CUE_COLOR);
  });
});

describe('Loop Serialization', () => {
  const testLoop: LoopData = {
    index: 0,
    inPoint: 44100,
    outPoint: 88200,
    color: 'cyan',
    name: '4 Bar Loop',
    isActive: false,
  };

  it('should serialize and deserialize loop data correctly', () => {
    const serialized = serializeLoop(testLoop);
    const deserialized = deserializeLoop(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.index).toBe(testLoop.index);
    expect(deserialized!.inPoint).toBe(testLoop.inPoint);
    expect(deserialized!.outPoint).toBe(testLoop.outPoint);
    expect(deserialized!.color).toBe(testLoop.color);
    expect(deserialized!.name).toBe(testLoop.name);
    expect(deserialized!.isActive).toBe(false); // Always false on deserialize
  });

  it('should handle all 8 color values', () => {
    const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const;

    for (const color of colors) {
      const loop: LoopData = { ...testLoop, color };
      const serialized = serializeLoop(loop);
      const deserialized = deserializeLoop(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.color).toBe(color);
    }
  });

  it('should handle all 8 loop slots', () => {
    for (let i = 0; i < 8; i++) {
      const loop: LoopData = { ...testLoop, index: i };
      const serialized = serializeLoop(loop);
      const deserialized = deserializeLoop(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.index).toBe(i);
    }
  });

  it('should return null for invalid data', () => {
    const invalidData = new Uint8Array([255, 254, 253]);
    const deserialized = deserializeLoop(invalidData);
    expect(deserialized).toBeNull();
  });
});

describe('Color Constants', () => {
  it('should have 16 colors in CUE_COLOR_INDEX', () => {
    // Extended palette: 16 colors for 8 cue pads + 8 loop pads
    expect(Object.keys(CUE_COLOR_INDEX)).toHaveLength(16);
  });

  it('should have matching forward and reverse color mappings', () => {
    for (const [color, index] of Object.entries(CUE_COLOR_INDEX)) {
      expect(INDEX_TO_CUE_COLOR[index]).toBe(color);
    }
  });

  it('should have hex values for all colors', () => {
    for (const color of Object.keys(CUE_COLOR_INDEX)) {
      expect(CUE_COLOR_HEX[color as keyof typeof CUE_COLOR_HEX]).toBeDefined();
      expect(CUE_COLOR_HEX[color as keyof typeof CUE_COLOR_HEX]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('should have green as default color', () => {
    expect(DEFAULT_CUE_COLOR).toBe('green');
  });
});

describe('Empty Hot Cue Creation', () => {
  it('should create empty hot cue with correct defaults', () => {
    const emptyCue = createEmptyHotCue(3);

    expect(emptyCue.index).toBe(3);
    expect(emptyCue.position).toBe(0);
    expect(emptyCue.color).toBe(DEFAULT_CUE_COLOR);
    expect(emptyCue.name).toBe('');
    expect(emptyCue.isSet).toBe(false);
  });

  it('should create array of 8 empty hot cues', () => {
    const emptyCues = createEmptyHotCues();

    expect(emptyCues).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(emptyCues[i].index).toBe(i);
      expect(emptyCues[i].isSet).toBe(false);
    }
  });
});

describe('Loop Length Label Calculation', () => {
  // Assuming 128 BPM and 44100 sample rate
  // samplesPerBeat = 44100 * 60 / 128 = 20671.875
  const samplesPerBeat = (44100 * 60) / 128;

  it('should calculate bars correctly', () => {
    const loop: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 16, // 4 bars
      color: 'green',
      name: '',
      isActive: false,
    };

    const label = calculateLoopLengthLabel(loop, samplesPerBeat);
    expect(label).toBe('4 bars');
  });

  it('should handle single bar', () => {
    const loop: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 4, // 1 bar
      color: 'green',
      name: '',
      isActive: false,
    };

    const label = calculateLoopLengthLabel(loop, samplesPerBeat);
    expect(label).toBe('1 bar');
  });

  it('should calculate beats correctly', () => {
    const loop: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 2, // 2 beats
      color: 'green',
      name: '',
      isActive: false,
    };

    const label = calculateLoopLengthLabel(loop, samplesPerBeat);
    expect(label).toBe('2 beats');
  });

  it('should handle single beat', () => {
    const loop: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat, // 1 beat
      color: 'green',
      name: '',
      isActive: false,
    };

    const label = calculateLoopLengthLabel(loop, samplesPerBeat);
    expect(label).toBe('1 beat');
  });

  it('should calculate fractional beats correctly', () => {
    const halfBeat: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 0.5,
      color: 'green',
      name: '',
      isActive: false,
    };
    expect(calculateLoopLengthLabel(halfBeat, samplesPerBeat)).toBe('1/2 beat');

    const quarterBeat: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 0.25,
      color: 'green',
      name: '',
      isActive: false,
    };
    expect(calculateLoopLengthLabel(quarterBeat, samplesPerBeat)).toBe('1/4 beat');

    const eighthBeat: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 0.125,
      color: 'green',
      name: '',
      isActive: false,
    };
    expect(calculateLoopLengthLabel(eighthBeat, samplesPerBeat)).toBe('1/8 beat');
  });

  it('should handle very short loops', () => {
    const tinyLoop: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 0.0625, // 1/16 beat
      color: 'green',
      name: '',
      isActive: false,
    };

    const label = calculateLoopLengthLabel(tinyLoop, samplesPerBeat);
    expect(label).toBe('1/16 beat');
  });

  it('should handle large loops', () => {
    const longLoop: LoopData = {
      index: 0,
      inPoint: 0,
      outPoint: samplesPerBeat * 64, // 16 bars
      color: 'green',
      name: '',
      isActive: false,
    };

    const label = calculateLoopLengthLabel(longLoop, samplesPerBeat);
    expect(label).toBe('16 bars');
  });
});
