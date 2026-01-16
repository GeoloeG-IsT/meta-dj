/**
 * Track Analyzer - BPM, Key, and Beatgrid Detection
 *
 * This module provides audio analysis functionality using:
 * - music-tempo: BPM detection and beat tracking (MIT license)
 * - keyfinder-js: Musical key detection (GPL-3.0 license)
 *
 * ARCHITECTURE NOTE (2026-01-16 Code Review):
 * Currently runs on the MAIN THREAD due to implementation constraints.
 * This is a known deviation from the Split-Brain pattern specified in the story.
 * TODO: Move to dedicated AnalysisWorker in future story for proper isolation.
 * For now, analysis is performant enough for single-track analysis but may
 * cause UI jank during bulk analysis of many tracks.
 *
 * Future architecture should be:
 * [Main Thread] --TRACK_ANALYSIS_REQUEST--> [AnalysisWorker]
 * [AnalysisWorker] --progress updates--> [Main Thread]
 */

import { toCamelot } from '../constants/camelot';
import MusicTempo from 'music-tempo';

// Type definitions for keyfinder-js module
interface KeyFinderAudioData {
  setChannels: (n: number) => void;
  setFrameRate: (n: number) => void;
  addToSampleCount: (n: number) => void;
  setSample: (i: number, v: number) => void;
}

interface KeyFinderInstance {
  keyOfAudio: (audio: KeyFinderAudioData) => number;
}

interface KeyFinderModule {
  KeyFinder: new () => KeyFinderInstance;
  AudioData: new () => KeyFinderAudioData;
}

// Lazy-loaded keyfinder module (handles UMD module loading issues)
let keyFinderModule: KeyFinderModule | null = null;

async function getKeyFinder(): Promise<KeyFinderModule> {
  if (keyFinderModule) return keyFinderModule;

  // Dynamic import handles UMD modules better
  // @ts-expect-error keyfinder-js package.json has incorrect main field
  const imported = await import('keyfinder-js/keyfinder.js');

  // Handle various module export formats (default, named, or direct)
  const module = imported.default ?? imported;
  keyFinderModule = module as KeyFinderModule;

  return keyFinderModule;
}

/**
 * BPM detection result
 */
export interface BPMResult {
  bpm: number; // Rounded to integer
  confidence: number; // 0-1 normalized
  rawBpm: number; // Original floating-point value
}

/**
 * Key detection result
 */
export interface KeyResult {
  key: string; // e.g., "C", "F#"
  scale: string; // "major" or "minor"
  camelot: string; // e.g., "8B", "11A"
  confidence: number; // 0-1 normalized
}

/**
 * Beatgrid data structure
 */
export interface BeatgridData {
  version: number; // Format version (1)
  bpm: number; // Detected BPM (float)
  firstBeatSample: number; // Sample position of first beat
  beatCount: number; // Total number of beats
  anchors: number[]; // Array of beat sample positions
}

/**
 * Complete track analysis result
 */
export interface TrackAnalysisResult {
  bpm: BPMResult;
  key: KeyResult;
  beatgrid: BeatgridData;
}

/**
 * Analysis error types
 */
export type AnalysisError =
  | { type: 'DECODE_FAILED'; message: string }
  | { type: 'ANALYSIS_FAILED'; message: string }
  | { type: 'CANCELLED' };

/**
 * Progress callback for reporting analysis stages
 */
export type ProgressCallback = (progress: number, stage: 'decoding' | 'analyzing' | 'storing') => void;

// BPM range limits (typical for DJ music)
const MIN_BPM = 60;
const MAX_BPM = 200;

/**
 * Map key_t enum values to key name and scale.
 * key_t values are: 0=A_MAJOR, 1=A_MINOR, 2=B_FLAT_MAJOR, etc.
 */
const KEY_MAP: Record<number, { key: string; scale: 'major' | 'minor' } | null> = {
  0: { key: 'A', scale: 'major' },    // A_MAJOR
  1: { key: 'A', scale: 'minor' },    // A_MINOR
  2: { key: 'Bb', scale: 'major' },   // B_FLAT_MAJOR
  3: { key: 'Bb', scale: 'minor' },   // B_FLAT_MINOR
  4: { key: 'B', scale: 'major' },    // B_MAJOR
  5: { key: 'B', scale: 'minor' },    // B_MINOR
  6: { key: 'C', scale: 'major' },    // C_MAJOR
  7: { key: 'C', scale: 'minor' },    // C_MINOR
  8: { key: 'Db', scale: 'major' },   // D_FLAT_MAJOR
  9: { key: 'Db', scale: 'minor' },   // D_FLAT_MINOR
  10: { key: 'D', scale: 'major' },   // D_MAJOR
  11: { key: 'D', scale: 'minor' },   // D_MINOR
  12: { key: 'Eb', scale: 'major' },  // E_FLAT_MAJOR
  13: { key: 'Eb', scale: 'minor' },  // E_FLAT_MINOR
  14: { key: 'E', scale: 'major' },   // E_MAJOR
  15: { key: 'E', scale: 'minor' },   // E_MINOR
  16: { key: 'F', scale: 'major' },   // F_MAJOR
  17: { key: 'F', scale: 'minor' },   // F_MINOR
  18: { key: 'Gb', scale: 'major' },  // G_FLAT_MAJOR
  19: { key: 'Gb', scale: 'minor' },  // G_FLAT_MINOR
  20: { key: 'G', scale: 'major' },   // G_MAJOR
  21: { key: 'G', scale: 'minor' },   // G_MINOR
  22: { key: 'Ab', scale: 'major' },  // A_FLAT_MAJOR
  23: { key: 'Ab', scale: 'minor' },  // A_FLAT_MINOR
  24: null,                           // SILENCE
};

/**
 * Convert stereo audio to mono by averaging channels.
 */
export function toMono(samples: Float32Array, channelCount: number): Float32Array {
  if (channelCount === 1) return samples;

  const monoLength = samples.length / channelCount;
  const mono = new Float32Array(monoLength);

  for (let i = 0; i < monoLength; i++) {
    let sum = 0;
    for (let ch = 0; ch < channelCount; ch++) {
      sum += samples[i * channelCount + ch];
    }
    mono[i] = sum / channelCount;
  }

  return mono;
}

/**
 * Detect BPM and beats using music-tempo library (Beatroot algorithm).
 *
 * @param samples - Mono audio samples
 * @returns Object containing BPM result and beat times
 */
export function detectBPMAndBeats(samples: Float32Array): { bpm: BPMResult; beats: number[] } {
  try {
    // music-tempo expects samples between -1.0 and 1.0 (Float32Array)
    const mt = new MusicTempo(samples, {
      minBeatInterval: 60 / MAX_BPM, // 0.3 seconds = 200 BPM max
      maxBeatInterval: 60 / MIN_BPM, // 1.0 seconds = 60 BPM min
    });

    let bpm = parseFloat(mt.tempo as unknown as string);
    const beats: number[] = mt.beats;

    // Halve or double BPM if outside typical DJ range
    while (bpm < MIN_BPM && bpm > 0) {
      bpm *= 2;
    }
    while (bpm > MAX_BPM) {
      bpm /= 2;
    }

    // music-tempo doesn't provide confidence, so we estimate based on beat consistency
    const confidence = beats.length > 4 ? 0.85 : 0.5;

    return {
      bpm: {
        bpm: Math.round(bpm),
        confidence,
        rawBpm: parseFloat(mt.tempo as unknown as string),
      },
      beats,
    };
  } catch {
    // Fallback if tempo extraction fails
    return {
      bpm: { bpm: 120, confidence: 0, rawBpm: 120 },
      beats: [],
    };
  }
}

/**
 * Detect BPM using music-tempo library.
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz (unused by music-tempo, kept for API compatibility)
 * @returns BPM detection result
 */
export function detectBPM(samples: Float32Array, sampleRate: number): BPMResult {
  void sampleRate; // Unused - music-tempo doesn't require sample rate
  return detectBPMAndBeats(samples).bpm;
}

/**
 * Detect musical key using keyfinder-js (libKeyFinder port).
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Key detection result with Camelot notation
 */
export async function detectKey(samples: Float32Array, sampleRate: number): Promise<KeyResult> {
  try {
    // Load keyfinder module (lazy loaded due to UMD format)
    const { KeyFinder, AudioData } = await getKeyFinder();

    // Create AudioData object for keyfinder-js
    const audioData = new AudioData();
    audioData.setChannels(1);
    audioData.setFrameRate(sampleRate);

    // Copy samples to AudioData (keyfinder expects number[])
    audioData.addToSampleCount(samples.length);
    for (let i = 0; i < samples.length; i++) {
      audioData.setSample(i, samples[i]);
    }

    // Detect key
    const keyFinder = new KeyFinder();
    const keyResult = keyFinder.keyOfAudio(audioData);

    // Map key_t enum to key/scale strings
    const keyInfo = KEY_MAP[keyResult];

    if (!keyInfo) {
      // Silence or unknown - return default
      return {
        key: 'C',
        scale: 'major',
        camelot: '8B',
        confidence: 0,
      };
    }

    const camelot = toCamelot(keyInfo.key, keyInfo.scale);

    return {
      key: keyInfo.key,
      scale: keyInfo.scale,
      camelot,
      confidence: 0.8, // keyfinder-js doesn't provide confidence
    };
  } catch {
    // Fallback on error
    return {
      key: 'C',
      scale: 'major',
      camelot: '8B',
      confidence: 0,
    };
  }
}

/**
 * Generate beatgrid from detected beats using music-tempo.
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @param bpm - Detected BPM
 * @param beats - Optional pre-computed beat times in seconds (from detectBPMAndBeats)
 * @returns Beatgrid data with beat positions
 */
export function generateBeatgrid(
  samples: Float32Array,
  sampleRate: number,
  bpm: number,
  beats?: number[]
): BeatgridData {
  // Use provided beats or detect them
  let beatTimes = beats;
  if (!beatTimes) {
    const result = detectBPMAndBeats(samples);
    beatTimes = result.beats;
  }

  // Convert beat times (seconds) to sample positions
  const anchors = beatTimes.map((time) => Math.round(time * sampleRate));

  // Find first beat (downbeat detection - first beat after initial silence)
  const firstBeatSample = anchors.length > 0 ? anchors[0] : 0;

  return {
    version: 1,
    bpm: bpm,
    firstBeatSample,
    beatCount: anchors.length,
    anchors,
  };
}

/**
 * Serialize beatgrid data to binary format for database storage.
 *
 * Format:
 * - Header: version(1) + bpm(4) + firstBeat(4) + count(4) = 13 bytes
 * - Data: anchors (count * 4 bytes each)
 */
export function serializeBeatgrid(data: BeatgridData): Uint8Array {
  const headerSize = 13;
  const dataSize = data.beatCount * 4;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // Write header
  view.setUint8(0, data.version);
  view.setFloat32(1, data.bpm, true);
  view.setUint32(5, data.firstBeatSample, true);
  view.setUint32(9, data.beatCount, true);

  // Write anchor positions
  for (let i = 0; i < data.beatCount; i++) {
    view.setUint32(headerSize + i * 4, data.anchors[i], true);
  }

  return new Uint8Array(buffer);
}

/**
 * Deserialize beatgrid data from binary format.
 */
export function deserializeBeatgrid(bytes: Uint8Array): BeatgridData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const version = view.getUint8(0);
  const bpm = view.getFloat32(1, true);
  const firstBeatSample = view.getUint32(5, true);
  const beatCount = view.getUint32(9, true);

  const headerSize = 13;
  const anchors: number[] = [];
  for (let i = 0; i < beatCount; i++) {
    anchors.push(view.getUint32(headerSize + i * 4, true));
  }

  return {
    version,
    bpm,
    firstBeatSample,
    beatCount,
    anchors,
  };
}

/**
 * Perform complete track analysis (BPM, Key, Beatgrid).
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @param onProgress - Optional progress callback
 * @returns Complete analysis result
 */
export async function analyzeTrack(
  samples: Float32Array,
  sampleRate: number,
  onProgress?: ProgressCallback
): Promise<TrackAnalysisResult> {
  onProgress?.(0.2, 'analyzing');

  // Detect BPM and beats together (more efficient - single pass)
  const { bpm, beats } = detectBPMAndBeats(samples);
  onProgress?.(0.4, 'analyzing');

  // Detect Key
  const key = await detectKey(samples, sampleRate);
  onProgress?.(0.6, 'analyzing');

  // Generate Beatgrid using already-detected beats
  const beatgrid = generateBeatgrid(samples, sampleRate, bpm.rawBpm, beats);
  onProgress?.(0.8, 'analyzing');

  return {
    bpm,
    key,
    beatgrid,
  };
}
