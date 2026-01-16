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
export { DeckUI } from './components/DeckUI';

// Services
export {
  loadTrackToDeck,
  loadTrackFromLibrary,
  pickAndLoadTrack,
  ejectTrack,
} from './services/deck-loader.service';

// Analysis
export {
  WaveformAnalyzer,
  waveformAnalyzer,
  FREQUENCY_BANDS,
  type WaveformData,
  type WaveformOptions,
} from './analysis/waveform-analyzer';

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

// Store
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
} from './types';
