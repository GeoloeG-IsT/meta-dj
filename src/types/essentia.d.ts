/**
 * Type declarations for essentia.js
 *
 * essentia.js is an audio analysis library using WebAssembly.
 * These are minimal declarations to satisfy TypeScript.
 */

declare module 'essentia.js' {
  export class Essentia {
    constructor(wasmModule: EssentiaWASMModule);

    // Audio analysis algorithms
    RhythmExtractor2013(
      signal: EssentiaVector,
      sampleRate: number
    ): {
      bpm: number;
      confidence: number;
      ticks: EssentiaVector;
      estimates: EssentiaVector;
      bpmIntervals: EssentiaVector;
    };

    KeyExtractor(
      signal: EssentiaVector,
      sampleRate: number
    ): {
      key: string;
      scale: string;
      strength: number;
    };

    BeatTrackerDegara(
      signal: EssentiaVector,
      sampleRate: number
    ): {
      ticks: EssentiaVector;
    };

    BeatTrackerMultiFeature(
      signal: EssentiaVector,
      maxTempo?: number,
      minTempo?: number
    ): {
      ticks: EssentiaVector;
      confidence: number;
    };

    // Utility methods
    arrayToVector(array: Float32Array): EssentiaVector;
    vectorToArray(vector: EssentiaVector): number[];
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface EssentiaWASMModule extends Record<string, unknown> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface EssentiaVector extends Record<string, unknown> {}

  export function EssentiaWASM(): Promise<EssentiaWASMModule>;
}
