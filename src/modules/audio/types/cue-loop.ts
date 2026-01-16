/**
 * Cue & Loop Type Definitions
 *
 * Type definitions for hot cue points and loop regions.
 * Compatible with Engine DJ database schema (PerformanceData table).
 *
 * Story 2.4: Hot Cue & Loop Management
 * Story 5.6: Implement 8-Loop System (Hot Loops + Saved Loops)
 */

/**
 * Loop pad mode for pad behavior.
 * - 'hot': Press-and-hold creates temporary loop, release exits
 * - 'saved': Click to jump to and activate saved loop
 */
export type LoopMode = 'hot' | 'saved';

/**
 * Extended 16-color palette for cue points and loops.
 * Provides distinct colors for all 8 cue pads and 8 loop pads.
 */
export type CueColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'violet'
  | 'pink'
  | 'rose'
  | 'coral'
  | 'amber';

/**
 * Color index mapping for database compatibility.
 * Used when serializing/deserializing from database.
 */
export const CUE_COLOR_INDEX: Record<CueColor, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  lime: 3,
  green: 4,
  teal: 5,
  cyan: 6,
  sky: 7,
  blue: 8,
  indigo: 9,
  purple: 10,
  violet: 11,
  pink: 12,
  rose: 13,
  coral: 14,
  amber: 15,
};

/**
 * Reverse mapping from index to color name.
 */
export const INDEX_TO_CUE_COLOR: Record<number, CueColor> = {
  0: 'red',
  1: 'orange',
  2: 'yellow',
  3: 'lime',
  4: 'green',
  5: 'teal',
  6: 'cyan',
  7: 'sky',
  8: 'blue',
  9: 'indigo',
  10: 'purple',
  11: 'violet',
  12: 'pink',
  13: 'rose',
  14: 'coral',
  15: 'amber',
};

/**
 * Hex color values for rendering.
 * Carefully chosen for visual distinction and readability.
 */
export const CUE_COLOR_HEX: Record<CueColor, string> = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  lime: '#32D74B',
  green: '#4DFA90', // Engine Green
  teal: '#30D5C8',
  cyan: '#5AC8FA',
  sky: '#64D2FF',
  blue: '#007AFF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  violet: '#BF5AF2',
  pink: '#FF2D92',
  rose: '#FF375F',
  coral: '#FF6B6B',
  amber: '#FFD60A',
};

/**
 * Default color for new cue points/loops (Engine Green).
 */
export const DEFAULT_CUE_COLOR: CueColor = 'green';

/**
 * Default colors for each pad index (0-7).
 * Each cue pad and loop pad gets a distinct default color.
 */
export const DEFAULT_CUE_COLORS: CueColor[] = [
  'red',      // Pad 1
  'orange',   // Pad 2
  'yellow',   // Pad 3
  'green',    // Pad 4
  'cyan',     // Pad 5
  'blue',     // Pad 6
  'purple',   // Pad 7
  'pink',     // Pad 8
];

/**
 * Default colors for each loop pad index (0-7).
 * Uses different colors from cue pads for visual distinction.
 */
export const DEFAULT_LOOP_COLORS: CueColor[] = [
  'coral',    // Loop 1
  'amber',    // Loop 2
  'lime',     // Loop 3
  'teal',     // Loop 4
  'sky',      // Loop 5
  'indigo',   // Loop 6
  'violet',   // Loop 7
  'rose',     // Loop 8
];

/**
 * Get the default color for a cue pad by index.
 */
export function getDefaultCueColor(padIndex: number): CueColor {
  return DEFAULT_CUE_COLORS[padIndex % DEFAULT_CUE_COLORS.length];
}

/**
 * Get the default color for a loop pad by index.
 */
export function getDefaultLoopColor(padIndex: number): CueColor {
  return DEFAULT_LOOP_COLORS[padIndex % DEFAULT_LOOP_COLORS.length];
}

/**
 * Hot Cue data structure (Engine DJ compatible).
 * Represents a single hot cue point on a track.
 */
export interface HotCueData {
  /** Pad number 0-7 (display as 1-8 in UI) */
  index: number;
  /** Sample position in the audio file */
  position: number;
  /** Color from the 8-color palette */
  color: CueColor;
  /** User-defined label (optional) */
  name: string;
  /** Whether this pad slot is assigned */
  isSet: boolean;
}

/**
 * Loop data structure (Engine DJ compatible).
 * Represents a loop region on a track.
 */
export interface LoopData {
  /** Loop slot 0-7 */
  index: number;
  /** Start sample position */
  inPoint: number;
  /** End sample position */
  outPoint: number;
  /** Color from the 8-color palette */
  color: CueColor;
  /** User-defined label (optional) */
  name: string;
  /** Whether loop is currently active (playing in loop) */
  isActive: boolean;
}

/**
 * Error types for cue/loop operations.
 */
export type CueLoopError =
  | { type: 'NO_TRACK'; message: string }
  | { type: 'SAVE_FAILED'; message: string }
  | { type: 'INVALID_POSITION'; message: string }
  | { type: 'PAD_OCCUPIED'; message: string }
  | { type: 'NOT_FOUND'; message: string };

/**
 * Serialized format for storing in database.
 * This is the binary format stored in PerformanceData.data column.
 */
export interface SerializedCueData {
  index: number;
  position: number;
  colorIndex: number;
  name: string;
}

export interface SerializedLoopData {
  index: number;
  inPoint: number;
  outPoint: number;
  colorIndex: number;
  name: string;
}

/**
 * Serialize a hot cue for database storage.
 *
 * @param cue - Hot cue data to serialize
 * @returns Uint8Array for database storage
 */
export function serializeHotCue(cue: HotCueData): Uint8Array {
  const data: SerializedCueData = {
    index: cue.index,
    position: cue.position,
    colorIndex: CUE_COLOR_INDEX[cue.color],
    name: cue.name,
  };
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  return encoder.encode(json);
}

/**
 * Deserialize a hot cue from database storage.
 *
 * @param data - Uint8Array from database
 * @returns Hot cue data or null if invalid
 */
export function deserializeHotCue(data: Uint8Array | ArrayBuffer | number[]): HotCueData | null {
  try {
    // Handle different input types
    let bytes: Uint8Array;
    if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      bytes = new Uint8Array(data);
    } else {
      return null;
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    const parsed: SerializedCueData = JSON.parse(json);

    return {
      index: parsed.index,
      position: parsed.position,
      color: INDEX_TO_CUE_COLOR[parsed.colorIndex] ?? DEFAULT_CUE_COLOR,
      name: parsed.name ?? '',
      isSet: true,
    };
  } catch {
    return null;
  }
}

/**
 * Serialize a loop for database storage.
 *
 * @param loop - Loop data to serialize
 * @returns Uint8Array for database storage
 */
export function serializeLoop(loop: LoopData): Uint8Array {
  const data: SerializedLoopData = {
    index: loop.index,
    inPoint: loop.inPoint,
    outPoint: loop.outPoint,
    colorIndex: CUE_COLOR_INDEX[loop.color],
    name: loop.name,
  };
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  return encoder.encode(json);
}

/**
 * Deserialize a loop from database storage.
 *
 * @param data - Uint8Array from database
 * @returns Loop data or null if invalid
 */
export function deserializeLoop(data: Uint8Array | ArrayBuffer | number[]): LoopData | null {
  try {
    // Handle different input types
    let bytes: Uint8Array;
    if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      bytes = new Uint8Array(data);
    } else {
      return null;
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    const parsed: SerializedLoopData = JSON.parse(json);

    return {
      index: parsed.index,
      inPoint: parsed.inPoint,
      outPoint: parsed.outPoint,
      color: INDEX_TO_CUE_COLOR[parsed.colorIndex] ?? DEFAULT_CUE_COLOR,
      name: parsed.name ?? '',
      isActive: false,
    };
  } catch {
    return null;
  }
}

/**
 * Create an empty hot cue for an unassigned pad.
 *
 * @param index - Pad index 0-7
 * @returns Empty hot cue data
 */
export function createEmptyHotCue(index: number): HotCueData {
  return {
    index,
    position: 0,
    color: DEFAULT_CUE_COLOR,
    name: '',
    isSet: false,
  };
}

/**
 * Create all 8 hot cue slots with empty state.
 *
 * @returns Array of 8 empty hot cues
 */
export function createEmptyHotCues(): HotCueData[] {
  return Array.from({ length: 8 }, (_, i) => createEmptyHotCue(i));
}

/**
 * Calculate loop length in beats.
 *
 * @param loop - Loop data
 * @param samplesPerBeat - Samples per beat (based on BPM and sample rate)
 * @returns Loop length as a beat fraction string (e.g., "4 bars", "1/2 beat")
 */
export function calculateLoopLengthLabel(
  loop: LoopData,
  samplesPerBeat: number
): string {
  const loopSamples = loop.outPoint - loop.inPoint;
  const beats = loopSamples / samplesPerBeat;

  // Convert to human-readable format
  if (beats >= 16) {
    const bars = Math.round(beats / 4);
    return `${bars} bars`;
  } else if (beats >= 4) {
    const bars = beats / 4;
    return bars === 1 ? '1 bar' : `${bars} bars`;
  } else if (beats >= 1) {
    return beats === 1 ? '1 beat' : `${beats} beats`;
  } else if (beats >= 0.5) {
    return '1/2 beat';
  } else if (beats >= 0.25) {
    return '1/4 beat';
  } else if (beats >= 0.125) {
    return '1/8 beat';
  } else {
    return '1/16 beat';
  }
}
