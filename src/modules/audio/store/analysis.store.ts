/**
 * Analysis Store - Zustand state management for track analysis
 *
 * Manages track analysis state including progress, queue, and results.
 * Designed for main thread only - analysis runs in the main thread with essentia.js WASM.
 */

import { create } from 'zustand';
import {
  analyzeTrackFromLibrary,
  warmupAnalyzer,
} from '../services/deck-loader.service';
import type { TrackAnalysisProgress } from '../types';

/**
 * Track analysis status
 */
export type AnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error';

/**
 * Analysis state for a single track
 */
export interface TrackAnalysisState {
  trackId: number;
  status: AnalysisStatus;
  progress: number; // 0-1
  stage: 'decoding' | 'analyzing' | 'storing' | null;
  error: string | null;
  bpm: number | null;
  key: string | null;
}

/**
 * Full analysis store state
 */
export interface AnalysisState {
  /** Current analysis state per track */
  tracks: Record<number, TrackAnalysisState>;
  /** Queue of track IDs waiting to be analyzed */
  queue: number[];
  /** Whether the analyzer is currently processing */
  isProcessing: boolean;
  /** Whether essentia WASM is ready */
  isReady: boolean;

  // Actions
  initializeAnalyzer: () => Promise<void>;
  analyzeTrack: (trackId: number) => Promise<void>;
  analyzeMultipleTracks: (trackIds: number[]) => void;
  cancelAnalysis: (trackId: number) => void;
  cancelAllAnalysis: () => void;
  clearAnalysisState: (trackId: number) => void;
}

/**
 * Create the analysis store
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  tracks: {},
  queue: [],
  isProcessing: false,
  isReady: false,

  /**
   * Initialize the essentia.js WASM module
   */
  initializeAnalyzer: async () => {
    try {
      await warmupAnalyzer();
      set({ isReady: true });
    } catch (error) {
      console.error('[AnalysisStore] Failed to initialize analyzer:', error);
    }
  },

  /**
   * Analyze a single track
   */
  analyzeTrack: async (trackId: number) => {
    const state = get();

    // Check if already analyzing this track
    if (state.tracks[trackId]?.status === 'analyzing') {
      console.log(`[AnalysisStore] Track ${trackId} is already being analyzed`);
      return;
    }

    // Initialize track state
    set((s) => ({
      tracks: {
        ...s.tracks,
        [trackId]: {
          trackId,
          status: 'analyzing',
          progress: 0,
          stage: 'decoding',
          error: null,
          bpm: null,
          key: null,
        },
      },
      isProcessing: true,
    }));

    try {
      // Initialize analyzer if not ready
      if (!get().isReady) {
        await warmupAnalyzer();
        set({ isReady: true });
      }

      // Progress callback
      const onProgress = (progress: TrackAnalysisProgress) => {
        set((s) => ({
          tracks: {
            ...s.tracks,
            [trackId]: {
              ...s.tracks[trackId],
              progress: progress.progress,
              stage: progress.stage,
            },
          },
        }));
      };

      // Run analysis
      const result = await analyzeTrackFromLibrary(trackId, onProgress);

      if (result) {
        // Update with results
        set((s) => ({
          tracks: {
            ...s.tracks,
            [trackId]: {
              ...s.tracks[trackId],
              status: 'complete',
              progress: 1,
              stage: null,
              bpm: result.bpm.bpm,
              key: result.key.camelot,
            },
          },
        }));
      } else {
        // File not accessible
        set((s) => ({
          tracks: {
            ...s.tracks,
            [trackId]: {
              ...s.tracks[trackId],
              status: 'error',
              error: 'File not accessible',
              stage: null,
            },
          },
        }));
      }
    } catch (error) {
      // Handle error
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      set((s) => ({
        tracks: {
          ...s.tracks,
          [trackId]: {
            ...s.tracks[trackId],
            status: 'error',
            error: errorMessage,
            stage: null,
          },
        },
      }));
    }

    // Process next in queue
    const nextQueue = get().queue.filter((id) => id !== trackId);
    set({ queue: nextQueue });

    if (nextQueue.length > 0) {
      // Continue with next track
      get().analyzeTrack(nextQueue[0]);
    } else {
      set({ isProcessing: false });
    }
  },

  /**
   * Add multiple tracks to the analysis queue
   */
  analyzeMultipleTracks: (trackIds: number[]) => {
    const state = get();

    // Filter out tracks already in queue or being analyzed
    const newTracks = trackIds.filter(
      (id) => !state.queue.includes(id) && state.tracks[id]?.status !== 'analyzing'
    );

    if (newTracks.length === 0) return;

    // Add to queue
    set((s) => ({
      queue: [...s.queue, ...newTracks],
    }));

    // Start processing if not already
    if (!state.isProcessing && newTracks.length > 0) {
      get().analyzeTrack(newTracks[0]);
    }
  },

  /**
   * Cancel analysis for a specific track
   */
  cancelAnalysis: (trackId: number) => {
    set((s) => ({
      queue: s.queue.filter((id) => id !== trackId),
      tracks: {
        ...s.tracks,
        [trackId]: {
          ...s.tracks[trackId],
          status: 'idle',
          progress: 0,
          stage: null,
        },
      },
    }));
  },

  /**
   * Cancel all pending analysis
   */
  cancelAllAnalysis: () => {
    const state = get();
    const updatedTracks: Record<number, TrackAnalysisState> = {};

    for (const trackId of state.queue) {
      updatedTracks[trackId] = {
        ...state.tracks[trackId],
        status: 'idle',
        progress: 0,
        stage: null,
      };
    }

    set({
      queue: [],
      tracks: {
        ...state.tracks,
        ...updatedTracks,
      },
    });
  },

  /**
   * Clear analysis state for a track
   */
  clearAnalysisState: (trackId: number) => {
    set((s) => {
      const { [trackId]: _, ...rest } = s.tracks;
      return { tracks: rest };
    });
  },
}));

// Selectors
export const selectTrackAnalysis = (trackId: number) => (state: AnalysisState) =>
  state.tracks[trackId];
export const selectAnalysisQueue = (state: AnalysisState) => state.queue;
export const selectIsProcessing = (state: AnalysisState) => state.isProcessing;
export const selectIsReady = (state: AnalysisState) => state.isReady;
