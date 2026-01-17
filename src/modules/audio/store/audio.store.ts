/**
 * Audio Store - Zustand state management for audio decks and waveforms
 *
 * Manages deck state, waveform data, and playback settings.
 * Designed for main thread only - workers access SharedArrayBuffer directly.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WaveformData } from '../analysis/waveform-analyzer';
import type { BeatgridData } from '../analysis/track-analyzer';
import type { WaveformColorMode, DeckId } from '../types';
import type { HotCueData, LoopData, LoopMode } from '../types/cue-loop';
import { createEmptyHotCues } from '../types/cue-loop';
import type { StemState, StemType, StemBuffers, StemAnalysisStage } from '../types/stems';
import { createInitialStemState } from '../types/stems';

/** Slip mode state for beatgrid editing */
export interface SlipModeState {
  /** Whether slip mode is currently active */
  isActive: boolean;
  /** Current sample offset during slip (not yet committed) */
  currentOffset: number;
  /** Starting mouse X position when slip started */
  startX: number;
  /** Original beatgrid firstBeatSample before slip started */
  originalFirstBeat: number;
  /** Index of beat that is currently snapped (for magnetic snap highlight) */
  snappedBeatIndex: number | null;
  /** Whether the current position is snapped to a transient */
  isSnapped: boolean;
}

/** EQ state for a single deck */
export interface EQState {
  /** Low band gain in dB (-24 to +6) */
  low: number;
  /** Mid band gain in dB (-24 to +6) */
  mid: number;
  /** High band gain in dB (-24 to +6) */
  high: number;
}

/** State for a single deck */
export interface DeckState {
  /** Track ID loaded in this deck */
  trackId: number | null;
  /** Track title */
  title: string;
  /** Track artist */
  artist: string;
  /** BPM of the loaded track */
  bpm: number;
  /** Track duration in seconds */
  duration: number;
  /** Sample rate of the loaded track */
  sampleRate: number;
  /** Whether this deck is currently playing */
  isPlaying: boolean;
  /** Current playhead position (0-1) */
  position: number;
  /** EQ settings */
  eq: EQState;
  /** Channel gain (0.0 to 1.5) */
  gain: number;
  /** Waveform data for visualization */
  waveformData: WaveformData | null;
  /** Beatgrid data for beat markers */
  beatgridData: BeatgridData | null;
  /** Detected transient positions for magnetic snap (sample positions) */
  transients: number[];
  /** Slip mode state for beatgrid editing */
  slipMode: SlipModeState;
  /** Whether waveform is currently being analyzed */
  isAnalyzing: boolean;
  /** Zoom level for detail view (bars visible) */
  zoomLevel: 1 | 2 | 4 | 8;
  /** Hot cue points (8 pads, some may be unset) */
  cuePoints: HotCueData[];
  /** Loop regions (stored loops) */
  loops: LoopData[];
  /** Currently active loop index (-1 if no loop active) */
  activeLoopIndex: number;
  /** Loop pad mode: 'hot' for press-and-hold, 'saved' for click-to-trigger */
  loopMode: LoopMode;
  /** Stem separation state */
  stems: StemState;
}

/** Global audio settings */
export interface AudioSettings {
  /** Waveform color mode for all decks */
  colorMode: WaveformColorMode;
  /** Master volume (0-1) */
  masterVolume: number;
  /** Active deck (receives keyboard commands) */
  activeDeck: DeckId;
  /** Whether WebGPU is available for stems feature */
  hasWebGPU: boolean;
  /** Reason why WebGPU is unavailable (if applicable) */
  webGPUUnavailableReason: string | null;
}

/** Full audio store state */
export interface AudioState {
  /** State for each deck */
  decks: Record<DeckId, DeckState>;
  /** Global settings */
  settings: AudioSettings;

  // Actions - Deck
  loadTrack: (deckId: DeckId, trackId: number, metadata: { title: string; artist: string; bpm: number; duration: number; sampleRate?: number }) => void;
  ejectTrack: (deckId: DeckId) => void;
  setPlaying: (deckId: DeckId, isPlaying: boolean) => void;
  setPosition: (deckId: DeckId, position: number) => void;
  setWaveformData: (deckId: DeckId, waveformData: WaveformData | null) => void;
  setBeatgridData: (deckId: DeckId, beatgridData: BeatgridData | null) => void;
  setTransients: (deckId: DeckId, transients: number[]) => void;
  setAnalyzing: (deckId: DeckId, isAnalyzing: boolean) => void;
  setZoomLevel: (deckId: DeckId, zoomLevel: 1 | 2 | 4 | 8) => void;

  // Actions - EQ & Gain
  setDeckEQ: (deckId: DeckId, band: 'low' | 'mid' | 'high', db: number) => void;
  setDeckGain: (deckId: DeckId, value: number) => void;

  // Actions - Slip Mode
  startSlipMode: (deckId: DeckId, startX: number, originalFirstBeat: number) => void;
  updateSlipOffset: (deckId: DeckId, offset: number) => void;
  setSnappedBeat: (deckId: DeckId, beatIndex: number | null, isSnapped: boolean) => void;
  cancelSlipMode: (deckId: DeckId) => void;
  commitSlipMode: (deckId: DeckId) => void;

  // Actions - Cue Points
  setCuePoints: (deckId: DeckId, cuePoints: HotCueData[]) => void;
  addCuePoint: (deckId: DeckId, cue: HotCueData) => void;
  updateCuePoint: (deckId: DeckId, cueIndex: number, updates: Partial<Pick<HotCueData, 'color' | 'name' | 'position'>>) => void;
  removeCuePoint: (deckId: DeckId, cueIndex: number) => void;

  // Actions - Loops
  setLoops: (deckId: DeckId, loops: LoopData[]) => void;
  addLoop: (deckId: DeckId, loop: LoopData) => void;
  updateLoop: (deckId: DeckId, loopIndex: number, updates: Partial<Pick<LoopData, 'color' | 'name' | 'inPoint' | 'outPoint'>>) => void;
  removeLoop: (deckId: DeckId, loopIndex: number) => void;
  setActiveLoop: (deckId: DeckId, loopIndex: number) => void;
  setLoopMode: (deckId: DeckId, mode: LoopMode) => void;

  // Actions - Stems
  setStemBuffers: (deckId: DeckId, buffers: StemBuffers) => void;
  setStemProgress: (deckId: DeckId, progress: number, stage: StemAnalysisStage | null) => void;
  setStemAnalyzing: (deckId: DeckId, analyzing: boolean) => void;
  toggleStemMute: (deckId: DeckId, stemType: StemType) => void;
  toggleStemSolo: (deckId: DeckId, stemType: StemType) => void;
  clearStems: (deckId: DeckId) => void;

  // Actions - Settings
  setColorMode: (mode: WaveformColorMode) => void;
  setMasterVolume: (volume: number) => void;
  setActiveDeck: (deckId: DeckId) => void;
  setWebGPUStatus: (available: boolean, unavailableReason?: string | null) => void;
}

/** Create initial slip mode state */
const createInitialSlipModeState = (): SlipModeState => ({
  isActive: false,
  currentOffset: 0,
  startX: 0,
  originalFirstBeat: 0,
  snappedBeatIndex: null,
  isSnapped: false,
});

/** Create initial EQ state */
const createInitialEQState = (): EQState => ({
  low: 0,
  mid: 0,
  high: 0,
});

/** Create initial deck state */
const createInitialDeckState = (): DeckState => ({
  trackId: null,
  title: '',
  artist: '',
  bpm: 120,
  duration: 0,
  sampleRate: 44100,
  isPlaying: false,
  position: 0,
  eq: createInitialEQState(),
  gain: 1.0,
  waveformData: null,
  beatgridData: null,
  transients: [],
  slipMode: createInitialSlipModeState(),
  isAnalyzing: false,
  zoomLevel: 4,
  cuePoints: createEmptyHotCues(),
  loops: [],
  activeLoopIndex: -1,
  loopMode: 'saved',
  stems: createInitialStemState(),
});

/** Create the audio store */
export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      // Initial state
      decks: {
        A: createInitialDeckState(),
        B: createInitialDeckState(),
        C: createInitialDeckState(),
        D: createInitialDeckState(),
      },
      settings: {
        colorMode: 'rgb',
        masterVolume: 1,
        activeDeck: 'A',
        hasWebGPU: false, // Will be set by initWebGPUDetection
        webGPUUnavailableReason: null,
      },

      // Deck actions
      loadTrack: (deckId, trackId, metadata) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              trackId,
              title: metadata.title,
              artist: metadata.artist,
              bpm: metadata.bpm,
              duration: metadata.duration,
              sampleRate: metadata.sampleRate ?? 44100,
              position: 0,
              isPlaying: false,
              waveformData: null,
              beatgridData: null,
              transients: [],
              slipMode: createInitialSlipModeState(),
              isAnalyzing: false,
              cuePoints: createEmptyHotCues(),
              loops: [],
              activeLoopIndex: -1,
            },
          },
        })),

      ejectTrack: (deckId) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: createInitialDeckState(),
          },
        })),

      setPlaying: (deckId, isPlaying) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              isPlaying,
            },
          },
        })),

      setPosition: (deckId, position) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              position: Math.max(0, Math.min(1, position)),
            },
          },
        })),

      setWaveformData: (deckId, waveformData) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              waveformData,
              isAnalyzing: false,
            },
          },
        })),

      setBeatgridData: (deckId, beatgridData) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              beatgridData,
            },
          },
        })),

      setTransients: (deckId, transients) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              transients,
            },
          },
        })),

      setAnalyzing: (deckId, isAnalyzing) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              isAnalyzing,
            },
          },
        })),

      setZoomLevel: (deckId, zoomLevel) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              zoomLevel,
            },
          },
        })),

      // EQ & Gain actions
      setDeckEQ: (deckId, band, db) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              eq: {
                ...state.decks[deckId].eq,
                [band]: Math.max(-24, Math.min(6, db)),
              },
            },
          },
        })),

      setDeckGain: (deckId, value) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              gain: Math.max(0, Math.min(1.5, value)),
            },
          },
        })),

      // Slip Mode actions
      startSlipMode: (deckId, startX, originalFirstBeat) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              slipMode: {
                isActive: true,
                currentOffset: 0,
                startX,
                originalFirstBeat,
                snappedBeatIndex: null,
                isSnapped: false,
              },
            },
          },
        })),

      updateSlipOffset: (deckId, offset) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              slipMode: {
                ...state.decks[deckId].slipMode,
                currentOffset: offset,
              },
            },
          },
        })),

      setSnappedBeat: (deckId, beatIndex, isSnapped) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              slipMode: {
                ...state.decks[deckId].slipMode,
                snappedBeatIndex: beatIndex,
                isSnapped,
              },
            },
          },
        })),

      cancelSlipMode: (deckId) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              slipMode: createInitialSlipModeState(),
            },
          },
        })),

      commitSlipMode: (deckId) =>
        set((state) => {
          const deck = state.decks[deckId];
          if (!deck.beatgridData || !deck.slipMode.isActive) {
            return state;
          }

          // Apply the offset to the beatgrid
          const newAnchors = deck.beatgridData.anchors.map(
            (anchor) => anchor + deck.slipMode.currentOffset
          );
          const newFirstBeat = deck.beatgridData.firstBeatSample + deck.slipMode.currentOffset;

          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                beatgridData: {
                  ...deck.beatgridData,
                  firstBeatSample: newFirstBeat,
                  anchors: newAnchors,
                },
                slipMode: createInitialSlipModeState(),
              },
            },
          };
        }),

      // Cue Point actions
      setCuePoints: (deckId, cuePoints) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              cuePoints,
            },
          },
        })),

      addCuePoint: (deckId, cue) =>
        set((state) => {
          const deck = state.decks[deckId];
          // Replace existing cue at the same index or add new
          const newCuePoints = [...deck.cuePoints];
          newCuePoints[cue.index] = cue;
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                cuePoints: newCuePoints,
              },
            },
          };
        }),

      updateCuePoint: (deckId, cueIndex, updates) =>
        set((state) => {
          const deck = state.decks[deckId];
          const existingCue = deck.cuePoints[cueIndex];
          if (!existingCue || !existingCue.isSet) {
            return state;
          }
          const newCuePoints = [...deck.cuePoints];
          newCuePoints[cueIndex] = { ...existingCue, ...updates };
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                cuePoints: newCuePoints,
              },
            },
          };
        }),

      removeCuePoint: (deckId, cueIndex) =>
        set((state) => {
          const deck = state.decks[deckId];
          const newCuePoints = [...deck.cuePoints];
          // Reset to empty cue instead of removing
          newCuePoints[cueIndex] = {
            index: cueIndex,
            position: 0,
            color: 'green',
            name: '',
            isSet: false,
          };
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                cuePoints: newCuePoints,
              },
            },
          };
        }),

      // Loop actions
      setLoops: (deckId, loops) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              loops,
            },
          },
        })),

      addLoop: (deckId, loop) =>
        set((state) => {
          const deck = state.decks[deckId];
          // Check if loop with same index exists
          const existingIndex = deck.loops.findIndex((l) => l.index === loop.index);
          const newLoops =
            existingIndex >= 0
              ? deck.loops.map((l, i) => (i === existingIndex ? loop : l))
              : [...deck.loops, loop];
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                loops: newLoops,
              },
            },
          };
        }),

      updateLoop: (deckId, loopIndex, updates) =>
        set((state) => {
          const deck = state.decks[deckId];
          const loopArrayIndex = deck.loops.findIndex((l) => l.index === loopIndex);
          if (loopArrayIndex < 0) {
            return state;
          }
          const existingLoop = deck.loops[loopArrayIndex];
          const newLoops = [...deck.loops];
          newLoops[loopArrayIndex] = { ...existingLoop, ...updates };
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                loops: newLoops,
              },
            },
          };
        }),

      removeLoop: (deckId, loopIndex) =>
        set((state) => {
          const deck = state.decks[deckId];
          const newLoops = deck.loops.filter((l) => l.index !== loopIndex);
          // If we removed the active loop, clear activeLoopIndex
          const newActiveIndex =
            deck.activeLoopIndex === loopIndex ? -1 : deck.activeLoopIndex;
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                loops: newLoops,
                activeLoopIndex: newActiveIndex,
              },
            },
          };
        }),

      setActiveLoop: (deckId, loopIndex) =>
        set((state) => {
          const deck = state.decks[deckId];
          // Toggle off if same loop clicked again
          const newActiveIndex =
            deck.activeLoopIndex === loopIndex ? -1 : loopIndex;
          // Update loop isActive status
          const newLoops = deck.loops.map((l) => ({
            ...l,
            isActive: l.index === newActiveIndex,
          }));
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                loops: newLoops,
                activeLoopIndex: newActiveIndex,
              },
            },
          };
        }),

      setLoopMode: (deckId, mode) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              loopMode: mode,
            },
          },
        })),

      // Stem actions
      setStemBuffers: (deckId, buffers) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              stems: {
                ...state.decks[deckId].stems,
                available: true,
                analyzing: false,
                progress: 100,
                stage: null,
                buffers,
              },
            },
          },
        })),

      setStemProgress: (deckId, progress, stage) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              stems: {
                ...state.decks[deckId].stems,
                progress,
                stage,
              },
            },
          },
        })),

      setStemAnalyzing: (deckId, analyzing) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              stems: {
                ...state.decks[deckId].stems,
                analyzing,
                progress: analyzing ? 0 : state.decks[deckId].stems.progress,
                stage: analyzing ? 'loading_model' : null,
              },
            },
          },
        })),

      toggleStemMute: (deckId, stemType) =>
        set((state) => {
          const deck = state.decks[deckId];
          const currentMuted = deck.stems.muted[stemType];
          // If toggling mute on the currently soloed stem, clear solo
          // (muting a soloed stem should unsolo it)
          const newSolo = deck.stems.solo === stemType ? null : deck.stems.solo;

          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                stems: {
                  ...deck.stems,
                  muted: {
                    ...deck.stems.muted,
                    [stemType]: !currentMuted,
                  },
                  solo: newSolo,
                },
              },
            },
          };
        }),

      toggleStemSolo: (deckId, stemType) =>
        set((state) => {
          const deck = state.decks[deckId];
          // Toggle solo: if same stem, unsolo; if different, solo new one
          const newSolo = deck.stems.solo === stemType ? null : stemType;

          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                stems: {
                  ...deck.stems,
                  solo: newSolo,
                  // When soloing, unmute the soloed stem
                  muted: newSolo
                    ? { ...deck.stems.muted, [newSolo]: false }
                    : deck.stems.muted,
                },
              },
            },
          };
        }),

      clearStems: (deckId) =>
        set((state) => ({
          decks: {
            ...state.decks,
            [deckId]: {
              ...state.decks[deckId],
              stems: createInitialStemState(),
            },
          },
        })),

      // Settings actions
      setColorMode: (mode) =>
        set((state) => ({
          settings: {
            ...state.settings,
            colorMode: mode,
          },
        })),

      setMasterVolume: (volume) =>
        set((state) => ({
          settings: {
            ...state.settings,
            masterVolume: Math.max(0, Math.min(1, volume)),
          },
        })),

      setActiveDeck: (deckId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            activeDeck: deckId,
          },
        })),

      setWebGPUStatus: (available, unavailableReason = null) =>
        set((state) => ({
          settings: {
            ...state.settings,
            hasWebGPU: available,
            webGPUUnavailableReason: unavailableReason,
          },
        })),
    }),
    {
      name: 'meta-dj-audio',
      // Only persist settings, not deck state
      partialize: (state) => ({
        settings: {
          colorMode: state.settings.colorMode,
          masterVolume: state.settings.masterVolume,
        },
      }),
    }
  )
);

// Selectors for optimized re-renders
export const selectDeck = (deckId: DeckId) => (state: AudioState) => state.decks[deckId];
export const selectColorMode = (state: AudioState) => state.settings.colorMode;
export const selectActiveDeck = (state: AudioState) => state.settings.activeDeck;
export const selectMasterVolume = (state: AudioState) => state.settings.masterVolume;
export const selectHasWebGPU = (state: AudioState) => state.settings.hasWebGPU;
export const selectWebGPUUnavailableReason = (state: AudioState) => state.settings.webGPUUnavailableReason;

// Stem selectors
export const selectDeckStems = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].stems;
export const selectStemAvailable = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].stems.available;
export const selectStemAnalyzing = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].stems.analyzing;
export const selectStemProgress = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].stems.progress;
export const selectStemMuted = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].stems.muted;
export const selectStemSolo = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].stems.solo;

// Loop selectors
export const selectDeckLoops = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].loops;
export const selectActiveLoopIndex = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].activeLoopIndex;
export const selectLoopMode = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].loopMode;

// EQ & Gain selectors
export const selectDeckEQ = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].eq;
export const selectDeckGain = (deckId: DeckId) => (state: AudioState) => state.decks[deckId].gain;
