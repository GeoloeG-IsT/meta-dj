/**
 * Analysis Store - Zustand state management for track analysis
 *
 * Manages track analysis state including progress, queue, and results.
 *
 * ARCHITECTURE NOTE (2026-01-16 Code Review):
 * Analysis currently runs on main thread. This is a known deviation from
 * the Split-Brain pattern. See track-analyzer.ts for details.
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
  /** ID of the track currently being analyzed */
  currentTrackId: number | null;
  /** Whether essentia WASM is ready */
  isReady: boolean;

  // Actions
  initializeAnalyzer: () => Promise<void>;
  analyzeTrack: (trackId: number) => Promise<void>;
  analyzeMultipleTracks: (trackIds: number[]) => void;
  cancelAnalysis: (trackId: number) => void;
  cancelAllAnalysis: () => void;
  clearAnalysisState: (trackId: number) => void;
  /** Internal: process next item in queue */
  _processQueue: () => void;
}

/**
 * Create the analysis store
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  tracks: {},
  queue: [],
  isProcessing: false,
  currentTrackId: null,
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

    // Check if another track is being analyzed - add to queue instead
    if (state.isProcessing && state.currentTrackId !== trackId) {
      if (!state.queue.includes(trackId)) {
        set((s) => ({ queue: [...s.queue, trackId] }));
      }
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
      currentTrackId: trackId,
    }));

    try {
      // Initialize analyzer if not ready
      if (!get().isReady) {
        await warmupAnalyzer();
        set({ isReady: true });
      }

      // Check if cancelled before starting heavy work
      if (get().tracks[trackId]?.status !== 'analyzing') {
        get()._processQueue();
        return;
      }

      // Progress callback
      const onProgress = (progress: TrackAnalysisProgress) => {
        // Check if still analyzing (not cancelled)
        const currentState = get().tracks[trackId];
        if (currentState?.status === 'analyzing') {
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
        }
      };

      // Run analysis
      const result = await analyzeTrackFromLibrary(trackId, onProgress);

      // Check if cancelled during analysis
      if (get().tracks[trackId]?.status !== 'analyzing') {
        get()._processQueue();
        return;
      }

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
      // Handle error (only if not cancelled)
      if (get().tracks[trackId]?.status === 'analyzing') {
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
    }

    // Always process next in queue
    get()._processQueue();
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

    // Start processing if not already (uses _processQueue to avoid race)
    if (!state.isProcessing) {
      get()._processQueue();
    }
  },

  /**
   * Cancel analysis for a specific track
   * Note: Cannot abort in-progress WASM analysis, but marks as cancelled
   * so results are discarded when analysis completes.
   */
  cancelAnalysis: (trackId: number) => {
    const state = get();
    const isCurrentTrack = state.currentTrackId === trackId;

    set((s) => ({
      queue: s.queue.filter((id) => id !== trackId),
      tracks: {
        ...s.tracks,
        [trackId]: {
          ...s.tracks[trackId],
          status: 'idle',
          progress: 0,
          stage: null,
          error: isCurrentTrack ? 'Cancelled' : null,
        },
      },
      // Clear current if cancelling current track
      currentTrackId: isCurrentTrack ? null : s.currentTrackId,
    }));

    // If we cancelled the current track, process next in queue
    if (isCurrentTrack) {
      // Use setTimeout to avoid potential recursion issues
      setTimeout(() => get()._processQueue(), 0);
    }
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

  /**
   * Internal: Process the next track in the queue
   * Centralized queue processing to avoid race conditions.
   */
  _processQueue: () => {
    const state = get();

    // Remove current track from queue if present
    const filteredQueue = state.queue.filter((id) => id !== state.currentTrackId);
    if (filteredQueue.length !== state.queue.length) {
      set({ queue: filteredQueue });
    }

    // If nothing in queue, mark as not processing
    if (filteredQueue.length === 0) {
      set({ isProcessing: false, currentTrackId: null });
      return;
    }

    // Process next track
    const nextTrackId = filteredQueue[0];
    set({
      queue: filteredQueue.slice(1),
      currentTrackId: null, // Will be set by analyzeTrack
      isProcessing: false, // Will be set by analyzeTrack
    });

    // Start next analysis
    get().analyzeTrack(nextTrackId);
  },
}));

// Selectors
export const selectTrackAnalysis = (trackId: number) => (state: AnalysisState) =>
  state.tracks[trackId];
export const selectAnalysisQueue = (state: AnalysisState) => state.queue;
export const selectIsProcessing = (state: AnalysisState) => state.isProcessing;
export const selectIsReady = (state: AnalysisState) => state.isReady;
