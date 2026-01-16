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
  /** Waveform data for visualization */
  waveformData: WaveformData | null;
  /** Beatgrid data for beat markers */
  beatgridData: BeatgridData | null;
  /** Slip mode state for beatgrid editing */
  slipMode: SlipModeState;
  /** Whether waveform is currently being analyzed */
  isAnalyzing: boolean;
  /** Zoom level for detail view (bars visible) */
  zoomLevel: 1 | 2 | 4 | 8;
}

/** Global audio settings */
export interface AudioSettings {
  /** Waveform color mode for all decks */
  colorMode: WaveformColorMode;
  /** Master volume (0-1) */
  masterVolume: number;
  /** Active deck (receives keyboard commands) */
  activeDeck: DeckId;
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
  setAnalyzing: (deckId: DeckId, isAnalyzing: boolean) => void;
  setZoomLevel: (deckId: DeckId, zoomLevel: 1 | 2 | 4 | 8) => void;

  // Actions - Slip Mode
  startSlipMode: (deckId: DeckId, startX: number, originalFirstBeat: number) => void;
  updateSlipOffset: (deckId: DeckId, offset: number) => void;
  setSnappedBeat: (deckId: DeckId, beatIndex: number | null, isSnapped: boolean) => void;
  cancelSlipMode: (deckId: DeckId) => void;
  commitSlipMode: (deckId: DeckId) => void;

  // Actions - Settings
  setColorMode: (mode: WaveformColorMode) => void;
  setMasterVolume: (volume: number) => void;
  setActiveDeck: (deckId: DeckId) => void;
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
  waveformData: null,
  beatgridData: null,
  slipMode: createInitialSlipModeState(),
  isAnalyzing: false,
  zoomLevel: 4,
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
              slipMode: createInitialSlipModeState(),
              isAnalyzing: false,
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
