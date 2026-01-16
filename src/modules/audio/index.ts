/**
 * Audio Module - Public API
 *
 * Exports all public components, hooks, types, and utilities
 * for audio playback and waveform visualization.
 */

// Components
export { WaveformCanvas } from './components/WaveformCanvas';
export { WaveformOverview } from './components/WaveformOverview';
export { WaveformDetail } from './components/WaveformDetail';
export { WaveformRenderer } from './components/WaveformRenderer';
export {
  AnalysisProgressInline,
  AnalysisProgressFull,
  AnalysisQueueStatus,
} from './components/AnalysisProgress';

// Services
export {
  loadTrackToDeck,
  loadTrackFromLibrary,
  pickAndLoadTrack,
  ejectTrack,
} from './services/deck-loader.service';

// Analysis - Waveform
export {
  WaveformAnalyzer,
  waveformAnalyzer,
  FREQUENCY_BANDS,
  type WaveformData,
  type WaveformOptions,
} from './analysis/waveform-analyzer';

// Analysis - Track (BPM/Key/Beatgrid)
export {
  analyzeTrack,
  detectBPM,
  detectBPMAndBeats,
  detectKey,
  generateBeatgrid,
  serializeBeatgrid,
  deserializeBeatgrid,
  toMono,
  type BPMResult,
  type KeyResult,
  type BeatgridData,
  type TrackAnalysisResult,
  type AnalysisError,
  type ProgressCallback,
} from './analysis/track-analyzer';

// Camelot Wheel
export {
  toCamelot,
  getCompatibleKeys,
  CAMELOT_WHEEL,
} from './constants/camelot';

// Hooks
export {
  usePlayheadSync,
  createPlayheadSAB,
  PlayheadReader,
  PlayheadWriter,
  interpolatePlayhead,
  PLAYHEAD_SAB_LAYOUT,
  type PlayheadState,
  type PlayheadSnapshot,
  type UsePlayheadSyncOptions,
} from './hooks/usePlayheadSync';

// Store - Audio
export {
  useAudioStore,
  selectDeck,
  selectColorMode,
  selectActiveDeck,
  selectMasterVolume,
  type AudioState,
  type DeckState,
  type AudioSettings,
} from './store/audio.store';

// Store - Analysis
export {
  useAnalysisStore,
  selectTrackAnalysis,
  selectAnalysisQueue,
  selectIsProcessing,
  selectIsReady,
  type AnalysisState,
  type TrackAnalysisState,
  type AnalysisStatus,
} from './store/analysis.store';

// Services
export {
  analyzeTrack as analyzeTrackWithFile,
  analyzeTrackFromLibrary,
  warmupAnalyzer,
  isTrackAnalyzed,
  getUnanalyzedTracks,
} from './services/deck-loader.service';

export {
  analysisService,
  PERFORMANCE_DATA_TYPE,
  type TrackAnalysisData,
  type StoredBeatgridData,
} from './services/analysis.service';

// Types
export {
  WAVEFORM_COLORS,
  type WaveformColorMode,
  type WaveformDisplayMode,
  type DeckId,
  type WaveformAnalysisRequest,
  type WaveformAnalysisResult,
  type WaveformProgressPayload,
  type SeekRequest,
  type TrackAnalysisRequest,
  type TrackAnalysisResponse,
  type TrackAnalysisProgress,
} from './types';
