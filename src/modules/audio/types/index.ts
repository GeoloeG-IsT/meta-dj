/**
 * Audio Module Types
 *
 * Type definitions for audio playback, analysis, and visualization.
 */

export { type WaveformData, type WaveformOptions, FREQUENCY_BANDS } from '../analysis/waveform-analyzer';
export {
  type BPMResult,
  type KeyResult,
  type BeatgridData,
  type TrackAnalysisResult,
  type AnalysisError,
  type ProgressCallback,
} from '../analysis/track-analyzer';

/** Color mode for waveform rendering */
export type WaveformColorMode = 'rgb' | 'blue' | '3band';

/** Waveform display mode */
export type WaveformDisplayMode = 'overview' | 'detail';

/** Deck identifier */
export type DeckId = 'A' | 'B' | 'C' | 'D';

/** Deck state */
export interface DeckState {
  id: DeckId;
  trackId: number | null;
  isPlaying: boolean;
  position: number; // Current playhead position in samples
  duration: number; // Track duration in seconds
  waveformData: import('../analysis/waveform-analyzer').WaveformData | null;
  colorMode: WaveformColorMode;
  zoomLevel: number; // Bars visible in detail view (1, 2, 4, 8)
}

/** Waveform analysis request payload */
export interface WaveformAnalysisRequest {
  trackId: number;
  audioBuffer: ArrayBuffer;
  sampleRate: number;
}

/** Waveform analysis result payload */
export interface WaveformAnalysisResult {
  trackId: number;
  waveformData: Uint8Array; // Serialized WaveformData
  sampleRate: number;
  duration: number;
  pointsPerSecond: number;
}

/** Waveform progress update payload */
export interface WaveformProgressPayload {
  trackId: number;
  progress: number; // 0-1
  stage: 'decoding' | 'analyzing' | 'storing';
}

/** Track analysis request payload */
export interface TrackAnalysisRequest {
  trackId: number;
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  channelCount: number;
}

/** Track analysis response payload */
export interface TrackAnalysisResponse {
  trackId: number;
  bpm: number; // Integer BPM
  bpmConfidence: number; // 0-1
  key: string; // Camelot notation (e.g., "8A")
  keyConfidence: number; // 0-1
  beatgridData: Uint8Array; // Serialized BeatgridData
  beatCount: number;
}

/** Track analysis progress payload */
export interface TrackAnalysisProgress {
  trackId: number;
  progress: number; // 0-1
  stage: 'decoding' | 'analyzing' | 'storing';
}

/** Seek request payload */
export interface SeekRequest {
  deckId: DeckId;
  position: number; // Position in samples or seconds
  unit: 'samples' | 'seconds' | 'percent';
}

/** Color constants from UX Design Specification */
export const WAVEFORM_COLORS = {
  // OLED Black theme
  BACKGROUND: '#000000',
  PLAYHEAD: '#4DFA90', // Engine Green
  SELECTION: '#2E8CFF', // Denon Blue

  // RGB frequency mode
  RGB: {
    LOW: '#FF3B30',   // Red for bass
    MID: '#4DFA90',   // Green for mids
    HIGH: '#2E8CFF',  // Blue for highs
  },

  // Blue mode (classic)
  BLUE: {
    LOW: '#1E90FF',
    MID: '#2E8CFF',
    HIGH: '#87CEEB',
  },

  // 3-Band stacked mode
  BAND3: {
    LOW: '#FF3B30',
    MID: '#4DFA90',
    HIGH: '#2E8CFF',
  },
} as const;
