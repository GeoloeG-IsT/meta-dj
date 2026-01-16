/**
 * DeckUI - Deck panel with waveform visualization
 *
 * Displays track info and waveforms for a single deck.
 * Supports loading tracks and real-time playhead updates.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { WaveformOverview } from './WaveformOverview';
import { WaveformDetail } from './WaveformDetail';
import { useAudioStore, selectDeck, selectColorMode } from '../store/audio.store';
import { pickAndLoadTrack, ejectTrack } from '../services/deck-loader.service';
import { analysisService } from '../services/analysis.service';
import { toast } from '@/shared/store/toast.store';
import type { WaveformColorMode, DeckId } from '../types';

export interface DeckUIProps {
  /** Deck identifier */
  deckId: DeckId;
  /** CSS class name */
  className?: string;
}

const COLOR_MODE_LABELS: Record<WaveformColorMode, string> = {
  rgb: 'RGB',
  blue: 'Blue',
  '3band': '3-Band',
};

const COLOR_MODES: WaveformColorMode[] = ['rgb', 'blue', '3band'];

/**
 * Deck UI component with waveform visualization.
 *
 * Features:
 * - Track info display (title, artist, BPM, key)
 * - Overview waveform with needle-drop seeking
 * - Detail waveform with zoom controls
 * - Color mode toggle
 */
export function DeckUI({ deckId, className = '' }: DeckUIProps) {
  const deck = useAudioStore(selectDeck(deckId));
  const colorMode = useAudioStore(selectColorMode);
  const setColorMode = useAudioStore((s) => s.setColorMode);
  const setPosition = useAudioStore((s) => s.setPosition);
  const setZoomLevel = useAudioStore((s) => s.setZoomLevel);

  // Slip mode actions
  const startSlipMode = useAudioStore((s) => s.startSlipMode);
  const updateSlipOffset = useAudioStore((s) => s.updateSlipOffset);
  const setSnappedBeat = useAudioStore((s) => s.setSnappedBeat);
  const cancelSlipMode = useAudioStore((s) => s.cancelSlipMode);
  const commitSlipMode = useAudioStore((s) => s.commitSlipMode);

  // Local playhead for demo (will be replaced by SAB sync in real implementation)
  const [playheadPosition, setPlayheadPosition] = useState(0);

  // Accumulator and debounce timer for keyboard nudge
  const nudgeAccumulatorRef = useRef(0);
  const nudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const NUDGE_DEBOUNCE_MS = 300;

  const handleSeek = useCallback(
    (normalizedPosition: number) => {
      setPlayheadPosition(normalizedPosition);
      setPosition(deckId, normalizedPosition);
    },
    [deckId, setPosition]
  );

  const handleZoomChange = useCallback(
    (zoomLevel: 1 | 2 | 4 | 8) => {
      setZoomLevel(deckId, zoomLevel);
    },
    [deckId, setZoomLevel]
  );

  // Slip mode callbacks
  const handleSlipStart = useCallback(
    (startX: number, originalFirstBeat: number) => {
      startSlipMode(deckId, startX, originalFirstBeat);
    },
    [deckId, startSlipMode]
  );

  const handleSlipUpdate = useCallback(
    (offset: number) => {
      updateSlipOffset(deckId, offset);
    },
    [deckId, updateSlipOffset]
  );

  const handleSlipCancel = useCallback(() => {
    cancelSlipMode(deckId);
  }, [deckId, cancelSlipMode]);

  const handleSlipCommit = useCallback(async () => {
    // Get current state before committing
    const state = useAudioStore.getState();
    const currentDeck = state.decks[deckId];

    if (!currentDeck.beatgridData || !currentDeck.slipMode.isActive || !currentDeck.trackId) {
      commitSlipMode(deckId);
      return;
    }

    // Store original beatgrid for rollback
    const originalBeatgrid = { ...currentDeck.beatgridData };

    // Calculate new beatgrid with offset applied
    const offset = currentDeck.slipMode.currentOffset;
    const newBeatgrid = {
      ...currentDeck.beatgridData,
      firstBeatSample: currentDeck.beatgridData.firstBeatSample + offset,
      anchors: currentDeck.beatgridData.anchors.map((anchor) => anchor + offset),
    };

    // Commit to local store (optimistic update)
    commitSlipMode(deckId);

    // Persist to database
    try {
      await analysisService.updateBeatgridOffset(currentDeck.trackId, newBeatgrid);
      toast.success('Beatgrid saved');
    } catch (error) {
      console.error('[DeckUI] Failed to save beatgrid:', error);
      // Rollback to original beatgrid on failure
      useAudioStore.getState().setBeatgridData(deckId, originalBeatgrid);
      toast.error('Failed to save beatgrid - rolled back');
    }
  }, [deckId, commitSlipMode]);

  const handleSnapChange = useCallback(
    (beatIndex: number | null, isSnapped: boolean) => {
      setSnappedBeat(deckId, beatIndex, isSnapped);
    },
    [deckId, setSnappedBeat]
  );

  // Keyboard nudge handler with debounced persistence
  const handleKeyboardNudge = useCallback(
    (sampleOffset: number) => {
      const state = useAudioStore.getState();
      const currentDeck = state.decks[deckId];

      if (!currentDeck.beatgridData || !currentDeck.trackId) return;

      // Accumulate the nudge
      nudgeAccumulatorRef.current += sampleOffset;

      // Apply accumulated offset to UI immediately (optimistic update)
      const accumulatedOffset = nudgeAccumulatorRef.current;
      const updatedBeatgrid = {
        ...currentDeck.beatgridData,
        firstBeatSample: currentDeck.beatgridData.firstBeatSample + sampleOffset,
        anchors: currentDeck.beatgridData.anchors.map((a) => a + sampleOffset),
      };
      useAudioStore.getState().setBeatgridData(deckId, updatedBeatgrid);

      // Clear existing timeout
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current);
      }

      // Debounce database write
      nudgeTimeoutRef.current = setTimeout(async () => {
        const finalState = useAudioStore.getState();
        const finalDeck = finalState.decks[deckId];

        if (!finalDeck.beatgridData || !finalDeck.trackId) return;

        try {
          await analysisService.updateBeatgridOffset(finalDeck.trackId, finalDeck.beatgridData);
          console.log(`[DeckUI] Beatgrid nudge saved (${accumulatedOffset} samples)`);
          toast.success('Beatgrid saved');
        } catch (error) {
          console.error('[DeckUI] Failed to save beatgrid nudge:', error);
          toast.error('Failed to save beatgrid');
        }

        // Reset accumulator
        nudgeAccumulatorRef.current = 0;
      }, NUDGE_DEBOUNCE_MS);
    },
    [deckId]
  );

  // Reset nudge accumulator and cleanup timeout when track changes
  useEffect(() => {
    // Reset on track change
    nudgeAccumulatorRef.current = 0;
    if (nudgeTimeoutRef.current) {
      clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = null;
    }
  }, [deck.trackId]);

  // Cleanup nudge timeout on unmount
  useEffect(() => {
    return () => {
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current);
      }
    };
  }, []);

  const cycleColorMode = useCallback(() => {
    const currentIndex = COLOR_MODES.indexOf(colorMode);
    const nextIndex = (currentIndex + 1) % COLOR_MODES.length;
    setColorMode(COLOR_MODES[nextIndex]);
  }, [colorMode, setColorMode]);

  const handleLoadFile = useCallback(async () => {
    try {
      await pickAndLoadTrack(deckId);
    } catch (error) {
      console.error('Failed to load track:', error);
    }
  }, [deckId]);

  const handleEject = useCallback(() => {
    ejectTrack(deckId);
    setPlayheadPosition(0);
  }, [deckId]);

  const hasTrack = deck.trackId !== null;

  return (
    <div
      className={`deck-ui bg-[#121212] border border-[#4DFA90]/30 rounded-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#4DFA90]/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#4DFA90]">{deckId}</span>
          <div
            className={`w-2 h-2 rounded-full ${
              deck.isPlaying ? 'bg-[#4DFA90] animate-pulse' : 'bg-[#4DFA90]/30'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          {hasTrack && (
            <button
              onClick={handleEject}
              className="px-2 py-1 text-xs font-mono uppercase bg-[#000] border border-red-500/50 text-red-400 rounded hover:border-red-500 hover:bg-red-500/10 transition-colors"
              title="Eject track"
            >
              ⏏
            </button>
          )}
          <button
            onClick={handleLoadFile}
            disabled={deck.isAnalyzing}
            className="px-3 py-1 text-xs font-mono uppercase bg-[#000] border border-[#4DFA90]/30 rounded hover:border-[#4DFA90] hover:bg-[#4DFA90]/10 transition-colors disabled:opacity-50"
            title="Load audio file"
          >
            Load
          </button>
          <button
            onClick={cycleColorMode}
            className="px-3 py-1 text-xs font-mono uppercase bg-[#000] border border-[#4DFA90]/30 rounded hover:border-[#4DFA90] transition-colors"
          >
            {COLOR_MODE_LABELS[colorMode]}
          </button>
        </div>
      </div>

      {/* Track Info */}
      <div className="px-4 py-3 border-b border-[#4DFA90]/10">
        {hasTrack ? (
          <div>
            <div className="text-lg font-semibold truncate">{deck.title || 'Unknown Title'}</div>
            <div className="text-sm text-[#4DFA90]/60 truncate">
              {deck.artist || 'Unknown Artist'}
            </div>
            <div className="flex gap-4 mt-2 text-xs font-mono text-[#4DFA90]/80">
              <span>{deck.bpm.toFixed(1)} BPM</span>
              <span>•</span>
              <span>{formatDuration(deck.duration)}</span>
            </div>
          </div>
        ) : (
          <div className="text-[#4DFA90]/40 text-sm italic">
            Double-click a track to load it here
          </div>
        )}
      </div>

      {/* Analyzing indicator */}
      {deck.isAnalyzing && (
        <div className="px-4 py-2 bg-[#4DFA90]/10 text-xs font-mono text-[#4DFA90] flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#4DFA90] border-t-transparent rounded-full animate-spin" />
          Analyzing waveform...
        </div>
      )}

      {/* Overview Waveform */}
      <div className="px-4 py-2">
        <WaveformOverview
          waveformData={deck.waveformData}
          playheadPosition={playheadPosition}
          colorMode={colorMode}
          onSeek={handleSeek}
          isPlaying={deck.isPlaying}
          height={48}
        />
      </div>

      {/* Detail Waveform */}
      <div className="px-4 pb-4">
        <WaveformDetail
          waveformData={deck.waveformData}
          beatgridData={deck.beatgridData}
          transients={deck.transients}
          playheadPosition={playheadPosition}
          colorMode={colorMode}
          onSeek={handleSeek}
          isPlaying={deck.isPlaying}
          bpm={deck.bpm}
          sampleRate={deck.sampleRate}
          zoomLevel={deck.zoomLevel}
          onZoomChange={handleZoomChange}
          height={100}
          isSlipModeActive={deck.slipMode.isActive}
          slipOffset={deck.slipMode.currentOffset}
          onSlipStart={handleSlipStart}
          onSlipUpdate={handleSlipUpdate}
          onSlipCommit={handleSlipCommit}
          onSlipCancel={handleSlipCancel}
          snappedBeatIndex={deck.slipMode.snappedBeatIndex}
          onSnapChange={handleSnapChange}
          onKeyboardNudge={handleKeyboardNudge}
        />
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
