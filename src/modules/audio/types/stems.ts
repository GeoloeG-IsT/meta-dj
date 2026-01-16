/**
 * Stem Separation Types
 *
 * Type definitions for client-side stem separation using ONNX Runtime Web.
 */

/** Available stem types from Demucs model */
export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

/** All stem types in order (matches model output order) */
export const STEM_TYPES: readonly StemType[] = ['vocals', 'drums', 'bass', 'other'] as const;

/** Stem-specific colors (per UX spec) */
export const STEM_COLORS: Record<StemType, string> = {
  vocals: '#5AC8FA', // Cyan
  drums: '#FF9500',  // Orange
  bass: '#AF52DE',   // Purple
  other: '#4DFA90',  // Engine Green
} as const;

/** Stem labels for UI */
export const STEM_LABELS: Record<StemType, string> = {
  vocals: 'VOX',
  drums: 'DRM',
  bass: 'BAS',
  other: 'OTH',
} as const;

/** Stem buffers container */
export interface StemBuffers {
  vocals: AudioBuffer | null;
  drums: AudioBuffer | null;
  bass: AudioBuffer | null;
  other: AudioBuffer | null;
}

/** Stem state for a deck */
export interface StemState {
  /** Stems have been analyzed and are available */
  available: boolean;
  /** Stem analysis is in progress */
  analyzing: boolean;
  /** Analysis progress (0-100) */
  progress: number;
  /** Current analysis stage */
  stage: StemAnalysisStage | null;
  /** Actual stem audio buffers */
  buffers: StemBuffers;
  /** Which stems are muted */
  muted: Record<StemType, boolean>;
  /** Which stem is soloed (only one at a time) */
  solo: StemType | null;
}

/** Analysis stage for progress reporting */
export type StemAnalysisStage =
  | 'loading_model'
  | 'preprocessing'
  | 'inference'
  | 'postprocessing';

/** Create initial stem state */
export function createInitialStemState(): StemState {
  return {
    available: false,
    analyzing: false,
    progress: 0,
    stage: null,
    buffers: {
      vocals: null,
      drums: null,
      bass: null,
      other: null,
    },
    muted: {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
    },
    solo: null,
  };
}

// ============================================================
// Worker Message Types
// ============================================================

/** Request to analyze stems for a track */
export interface StemAnalyzeRequest {
  trackId: number;
  /** Raw audio data (Float32Array stereo interleaved) */
  audioData: ArrayBuffer;
  /** Audio sample rate */
  sampleRate: number;
  /** Number of channels (should be 2 for stereo) */
  channels: number;
}

/** Progress update during analysis */
export interface StemAnalyzeProgress {
  trackId: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current stage of analysis */
  stage: StemAnalysisStage;
}

/** Successful completion of stem analysis */
export interface StemAnalyzeComplete {
  trackId: number;
  /** Separated stem buffers as ArrayBuffers (transferable) */
  stems: {
    vocals: ArrayBuffer;
    drums: ArrayBuffer;
    bass: ArrayBuffer;
    other: ArrayBuffer;
  };
  /** Sample rate of output (same as input) */
  sampleRate: number;
}

/** Error during stem analysis */
export interface StemAnalyzeError {
  trackId: number;
  /** Error type for categorized handling */
  errorType: StemErrorType;
  /** Human-readable error message */
  message: string;
}

/** Types of stem errors */
export type StemErrorType =
  | 'WEBGPU_UNAVAILABLE'
  | 'MODEL_LOAD_FAILED'
  | 'INFERENCE_FAILED'
  | 'OUT_OF_MEMORY'
  | 'CANCELLED'
  | 'INVALID_INPUT';

/** Request to cancel ongoing analysis */
export interface StemAnalyzeCancel {
  trackId: number;
}

/** Model loading progress */
export interface StemModelLoading {
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
}

/** Model ready notification */
export interface StemModelReady {
  /** Model name/version loaded */
  modelName: string;
  /** Whether using WebGPU backend */
  isWebGPU: boolean;
}
