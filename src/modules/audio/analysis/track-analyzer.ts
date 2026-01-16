/**
 * Track Analyzer - BPM, Key, and Beatgrid Detection
 *
 * This module provides audio analysis functionality using essentia.js WASM.
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

// Lazy-loaded essentia module
let essentiaModule: any = null;
let essentia: any = null;

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
  | { type: 'WASM_INIT_FAILED'; message: string }
  | { type: 'CANCELLED' };

/**
 * Progress callback for reporting analysis stages
 */
export type ProgressCallback = (progress: number, stage: 'decoding' | 'analyzing' | 'storing') => void;

// BPM range limits (typical for DJ music)
const MIN_BPM = 60;
const MAX_BPM = 200;

/**
 * Initialize essentia.js WASM module.
 * Lazy-loads the module on first call.
 */
export async function initEssentia(): Promise<void> {
  if (essentia) return;

  let loadedModule: any = null;
  try {
    // Dynamic import for worker context
    const { Essentia, EssentiaWASM } = await import('essentia.js');
    loadedModule = await EssentiaWASM();
    const loadedEssentia = new Essentia(loadedModule);
    // Only assign to globals after both succeed
    essentiaModule = loadedModule;
    essentia = loadedEssentia;
  } catch (err) {
    // Clean up partially loaded module on failure
    loadedModule = null;
    essentiaModule = null;
    essentia = null;
    const error: AnalysisError = {
      type: 'WASM_INIT_FAILED',
      message: err instanceof Error ? err.message : 'Failed to initialize Essentia WASM',
    };
    throw error;
  }
}

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
 * Convert Float32Array to essentia vector format.
 */
function toEssentiaVector(samples: Float32Array): any {
  if (!essentia) throw new Error('Essentia not initialized');
  return essentia.arrayToVector(samples);
}

/**
 * Free essentia vector memory to avoid leaks.
 */
function freeVector(vector: any): void {
  if (vector && vector.delete) {
    vector.delete();
  }
}

/**
 * Detect BPM using RhythmExtractor2013 algorithm.
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns BPM detection result
 */
export function detectBPM(samples: Float32Array, sampleRate: number): BPMResult {
  if (!essentia) throw new Error('Essentia not initialized');

  const vector = toEssentiaVector(samples);

  try {
    // Use RhythmExtractor2013 for BPM detection
    const result = essentia.RhythmExtractor2013(vector, sampleRate);

    // Extract BPM and confidence
    let bpm = result.bpm;
    const confidence = Math.min(result.confidence / 5.32, 1); // Normalize to 0-1

    // Halve or double BPM if outside typical DJ range
    while (bpm < MIN_BPM && bpm > 0) {
      bpm *= 2;
    }
    while (bpm > MAX_BPM) {
      bpm /= 2;
    }

    return {
      bpm: Math.round(bpm),
      confidence,
      rawBpm: result.bpm,
    };
  } finally {
    freeVector(vector);
  }
}

/**
 * Detect musical key using KeyExtractor algorithm.
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Key detection result with Camelot notation
 */
export function detectKey(samples: Float32Array, sampleRate: number): KeyResult {
  if (!essentia) throw new Error('Essentia not initialized');

  const vector = toEssentiaVector(samples);

  try {
    // Use KeyExtractor for key detection
    const result = essentia.KeyExtractor(vector, sampleRate);

    const key = result.key;
    const scale = result.scale;
    const camelot = toCamelot(key, scale);
    const confidence = Math.min(result.strength, 1); // Normalize to 0-1

    return {
      key,
      scale,
      camelot,
      confidence,
    };
  } finally {
    freeVector(vector);
  }
}

/**
 * Generate beatgrid from detected beats.
 *
 * @param samples - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @param bpm - Detected BPM
 * @returns Beatgrid data with beat positions
 */
export function generateBeatgrid(
  samples: Float32Array,
  sampleRate: number,
  bpm: number
): BeatgridData {
  if (!essentia) throw new Error('Essentia not initialized');

  const vector = toEssentiaVector(samples);

  try {
    // Use BeatTrackerDegara for beat detection
    const result = essentia.BeatTrackerDegara(vector, sampleRate);

    // Convert beat times (seconds) to sample positions
    const beatTimes: number[] = essentia.vectorToArray(result.ticks);
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
  } finally {
    freeVector(vector);
  }
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
  // Ensure essentia is initialized
  await initEssentia();

  onProgress?.(0.2, 'analyzing');

  // Detect BPM
  const bpm = detectBPM(samples, sampleRate);
  onProgress?.(0.4, 'analyzing');

  // Detect Key
  const key = detectKey(samples, sampleRate);
  onProgress?.(0.6, 'analyzing');

  // Generate Beatgrid
  const beatgrid = generateBeatgrid(samples, sampleRate, bpm.rawBpm);
  onProgress?.(0.8, 'analyzing');

  return {
    bpm,
    key,
    beatgrid,
  };
}

/**
 * Get whether essentia is initialized.
 */
export function isEssentiaReady(): boolean {
  return essentia !== null;
}

/**
 * Clean up essentia resources.
 * Call this when the worker is being terminated.
 */
export function cleanupEssentia(): void {
  if (essentiaModule) {
    // Note: essentia.js doesn't have explicit cleanup, but we null references
    essentia = null;
    essentiaModule = null;
  }
}
