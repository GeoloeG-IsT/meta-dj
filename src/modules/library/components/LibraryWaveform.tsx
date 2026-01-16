/**
 * LibraryWaveform - Deck panel with waveform visualization
 *
 * Displays track info and waveforms for a single deck.
 * Supports loading tracks and real-time playhead updates.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { WaveformOverview } from '@/modules/audio/components/WaveformOverview';
import { WaveformDetail } from '@/modules/audio/components/WaveformDetail';
import { PerformancePads } from '@/modules/audio/components/PerformancePads';
import { LoopControls } from '@/modules/audio/components/LoopControls';
import { LoopPads } from '@/modules/audio/components/LoopPads';
import { LoopModeToggle } from '@/modules/audio/components/LoopModeToggle';
import { CueContextMenu } from '@/modules/audio/components/CueContextMenu';
import { StemControls } from '@/modules/audio/components/StemControls';
import {
  useAudioStore,
  selectDeck,
  selectColorMode,
  selectHasWebGPU,
  selectWebGPUUnavailableReason,
  selectDeckStems,
  selectLoopMode,
} from '@/modules/audio/store/audio.store';
import { pickAndLoadTrack, ejectTrack } from '@/modules/audio/services/deck-loader.service';
import { DeckEngineService } from '@/modules/audio/services/deck-engine.service';
import { usePlayheadSync } from '@/modules/audio/hooks/usePlayheadSync';
import { analysisService } from '@/modules/audio/services/analysis.service';
import { toast } from '@/shared/store/toast.store';
import type { WaveformColorMode, DeckId } from '@/modules/audio/types';
import type { HotCueData, LoopData, CueColor, LoopMode } from '@/modules/audio/types/cue-loop';
import { getDefaultCueColor, getDefaultLoopColor } from '@/modules/audio/types/cue-loop';
import type { StemType } from '@/modules/audio/types/stems';
import { stemsService, StemsService } from '@/modules/audio/services/stems.service';

export interface LibraryWaveformProps {
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
 * LibraryWaveform component with waveform visualization.
 *
 * Features:
 * - Track info display (title, artist, BPM, key)
 * - Overview waveform with needle-drop seeking
 * - Detail waveform with zoom controls
 * - Color mode toggle
 */
export function LibraryWaveform({ deckId, className = '' }: LibraryWaveformProps) {
  const deck = useAudioStore(selectDeck(deckId));
  const colorMode = useAudioStore(selectColorMode);
  const setColorMode = useAudioStore((s) => s.setColorMode);
  const setPosition = useAudioStore((s) => s.setPosition);
  const setZoomLevel = useAudioStore((s) => s.setZoomLevel);

  // Stem state and actions
  const hasWebGPU = useAudioStore(selectHasWebGPU);
  const webGPUUnavailableReason = useAudioStore(selectWebGPUUnavailableReason);
  const stemState = useAudioStore(selectDeckStems(deckId));
  const toggleStemMute = useAudioStore((s) => s.toggleStemMute);
  const toggleStemSolo = useAudioStore((s) => s.toggleStemSolo);
  const setStemAnalyzing = useAudioStore((s) => s.setStemAnalyzing);
  const setStemProgress = useAudioStore((s) => s.setStemProgress);
  const setStemBuffers = useAudioStore((s) => s.setStemBuffers);

  // Slip mode actions
  const startSlipMode = useAudioStore((s) => s.startSlipMode);
  const updateSlipOffset = useAudioStore((s) => s.updateSlipOffset);
  const setSnappedBeat = useAudioStore((s) => s.setSnappedBeat);
  const cancelSlipMode = useAudioStore((s) => s.cancelSlipMode);
  const commitSlipMode = useAudioStore((s) => s.commitSlipMode);

  // Cue point actions
  const addCuePoint = useAudioStore((s) => s.addCuePoint);
  const removeCuePoint = useAudioStore((s) => s.removeCuePoint);

  // Loop actions
  const addLoop = useAudioStore((s) => s.addLoop);
  const removeLoop = useAudioStore((s) => s.removeLoop);
  const setActiveLoop = useAudioStore((s) => s.setActiveLoop);
  const updateLoop = useAudioStore((s) => s.updateLoop);
  const loopMode = useAudioStore(selectLoopMode(deckId));
  const setLoopMode = useAudioStore((s) => s.setLoopMode);

  // Cue update action
  const updateCuePoint = useAudioStore((s) => s.updateCuePoint);

  // Check if track is loaded (needed early for playhead sync)
  const hasTrack = deck.trackId !== null;

  // State for SAB - needs to be state so we can trigger re-renders when it becomes available
  const [playheadSAB, setPlayheadSAB] = useState<SharedArrayBuffer | null>(null);

  // Get SAB for real-time playhead sync from AudioWorklet
  // Use an effect with retry logic to handle the race condition where
  // the engine may not be fully initialized when isAnalyzing becomes false
  useEffect(() => {
    if (!hasTrack) {
      setPlayheadSAB(null);
      return;
    }

    // Try to get SAB immediately
    if (DeckEngineService.isInitialized()) {
      const sab = DeckEngineService.getPlayheadSAB(deckId);
      setPlayheadSAB(sab);
      return;
    }

    // If not initialized yet, poll until it is
    let cancelled = false;
    const checkInterval = setInterval(() => {
      if (cancelled) return;
      if (DeckEngineService.isInitialized()) {
        const sab = DeckEngineService.getPlayheadSAB(deckId);
        console.log('[LibraryWaveform] SAB retrieved after polling:', !!sab);
        setPlayheadSAB(sab);
        clearInterval(checkInterval);
      }
    }, 50); // Check every 50ms

    return () => {
      cancelled = true;
      clearInterval(checkInterval);
    };
  }, [deckId, hasTrack, deck.isAnalyzing]);

  const { normalizedPosition: playheadPosition } = usePlayheadSync({
    sharedArrayBuffer: playheadSAB,
    enabled: hasTrack && playheadSAB !== null,
  });

  // Debug: Log playhead sync status
  useEffect(() => {
    console.log('[LibraryWaveform] Playhead sync status:', {
      deckId,
      hasTrack,
      isAnalyzing: deck.isAnalyzing,
      engineInitialized: DeckEngineService.isInitialized(),
      hasSAB: playheadSAB !== null,
      playheadPosition,
    });
  }, [deckId, hasTrack, deck.isAnalyzing, playheadSAB, playheadPosition]);

  // Accumulator and debounce timer for keyboard nudge
  const nudgeAccumulatorRef = useRef(0);
  const nudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const NUDGE_DEBOUNCE_MS = 300;

  const handleSeek = useCallback(
    (normalizedPosition: number) => {
      setPosition(deckId, normalizedPosition);
      // Seek in audio engine
      if (DeckEngineService.isInitialized()) {
        DeckEngineService.seekToNormalized(deckId, normalizedPosition);
      }
    },
    [deckId, setPosition]
  );

  // Play/Pause transport control
  const handlePlayPause = useCallback(() => {
    if (DeckEngineService.isInitialized()) {
      DeckEngineService.togglePlayPause(deckId);
    }
  }, [deckId]);

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
      console.error('[LibraryWaveform] Failed to save beatgrid:', error);
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
          console.log(`[LibraryWaveform] Beatgrid nudge saved (${accumulatedOffset} samples)`);
          toast.success('Beatgrid saved');
        } catch (error) {
          console.error('[LibraryWaveform] Failed to save beatgrid nudge:', error);
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

  // Cue point pad click handler - set or trigger cue
  const handlePadClick = useCallback(
    async (padIndex: number) => {
      if (!deck.trackId) return;

      const existingCue = deck.cuePoints[padIndex];

      if (existingCue?.isSet) {
        // Cue exists - trigger (seek to cue position)
        // First, deactivate any active loop so we can jump out of it
        if (deck.activeLoopIndex >= 0) {
          setActiveLoop(deckId, -1);
        }
        const normalizedPosition = existingCue.position / (deck.duration * deck.sampleRate);
        setPosition(deckId, normalizedPosition);
        // Seek audio engine
        if (DeckEngineService.isInitialized()) {
          DeckEngineService.seek(deckId, existingCue.position);
        }
      } else {
        // No cue at this pad - set new cue at current position
        const samplePosition = Math.round(playheadPosition * deck.duration * deck.sampleRate);
        const newCue: HotCueData = {
          index: padIndex,
          position: samplePosition,
          color: getDefaultCueColor(padIndex),
          name: '',
          isSet: true,
        };

        // Optimistic update
        addCuePoint(deckId, newCue);

        // Persist to database
        try {
          await analysisService.saveCuePoint(deck.trackId, newCue);
          toast.success(`Cue ${padIndex + 1} set`);
        } catch (error) {
          console.error('[LibraryWaveform] Failed to save cue point:', error);
          // Rollback on failure
          removeCuePoint(deckId, padIndex);
          toast.error('Failed to save cue point');
        }
      }
    },
    [deckId, deck.trackId, deck.cuePoints, deck.duration, deck.sampleRate, deck.activeLoopIndex, playheadPosition, addCuePoint, removeCuePoint, setPosition, setActiveLoop]
  );

  // Context menu state for cue/loop management
  const [contextMenuState, setContextMenuState] = useState<{
    type: 'cue' | 'loop';
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // Loop in-point pending state (when user has set IN but not OUT yet)
  const [pendingLoopInPoint, setPendingLoopInPoint] = useState<number | null>(null);

  // Reset pending loop in-point when track changes
  useEffect(() => {
    setPendingLoopInPoint(null);
  }, [deck.trackId]);

  const handlePadContextMenu = useCallback((padIndex: number, event: React.MouseEvent) => {
    // Only show context menu if the cue is set
    if (deck.cuePoints[padIndex]?.isSet) {
      setContextMenuState({
        type: 'cue',
        index: padIndex,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }, [deck.cuePoints]);

  const handleLoopContextMenu = useCallback((loopIndex: number, event: React.MouseEvent) => {
    // Show context menu for loops
    setContextMenuState({
      type: 'loop',
      index: loopIndex,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  // Handle loop click on waveform - seek to loop and activate
  const handleWaveformLoopClick = useCallback(
    (loopIndex: number) => {
      const loop = deck.loops.find((l) => l.index === loopIndex);
      if (!loop) return;

      // First, set the new loop in the audio engine BEFORE seeking
      // This prevents the old loop from catching the seek
      if (DeckEngineService.isInitialized()) {
        DeckEngineService.setLoop(deckId, loop.inPoint, loop.outPoint);
        DeckEngineService.seek(deckId, loop.inPoint);
      }

      // Update UI state
      const normalizedPosition = loop.inPoint / (deck.duration * deck.sampleRate);
      setPosition(deckId, normalizedPosition);
      setActiveLoop(deckId, loopIndex);
    },
    [deckId, deck.loops, deck.duration, deck.sampleRate, setPosition, setActiveLoop]
  );

  // Handle cue click on waveform - seek to cue position
  const handleWaveformCueClick = useCallback(
    (cueIndex: number) => {
      const cue = deck.cuePoints[cueIndex];
      if (!cue?.isSet) return;

      // Seek to cue position
      const normalizedPosition = cue.position / (deck.duration * deck.sampleRate);
      setPosition(deckId, normalizedPosition);
      // Seek audio engine
      if (DeckEngineService.isInitialized()) {
        DeckEngineService.seek(deckId, cue.position);
      }
    },
    [deckId, deck.cuePoints, deck.duration, deck.sampleRate, setPosition]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  // Context menu action handlers
  const handleContextMenuColorChange = useCallback(
    async (color: CueColor) => {
      if (!contextMenuState || !deck.trackId) return;

      const { type, index } = contextMenuState;

      if (type === 'cue') {
        const originalColor = deck.cuePoints[index]?.color;
        // Optimistic update
        updateCuePoint(deckId, index, { color });
        // Persist
        try {
          await analysisService.updateCuePoint(deck.trackId, index, { color });
          toast.success('Color updated');
        } catch (error) {
          console.error('[LibraryWaveform] Failed to update cue color:', error);
          // Rollback on failure
          if (originalColor) {
            updateCuePoint(deckId, index, { color: originalColor });
          }
          toast.error('Failed to update color');
        }
      } else {
        const originalLoop = deck.loops.find((l) => l.index === index);
        const originalColor = originalLoop?.color;
        // Optimistic update
        updateLoop(deckId, index, { color });
        // Persist
        try {
          await analysisService.updateLoop(deck.trackId, index, { color });
          toast.success('Color updated');
        } catch (error) {
          console.error('[LibraryWaveform] Failed to update loop color:', error);
          // Rollback on failure
          if (originalColor) {
            updateLoop(deckId, index, { color: originalColor });
          }
          toast.error('Failed to update color');
        }
      }
    },
    [contextMenuState, deckId, deck.trackId, deck.cuePoints, deck.loops, updateCuePoint, updateLoop]
  );

  const handleContextMenuNameChange = useCallback(
    async (name: string) => {
      if (!contextMenuState || !deck.trackId) return;

      const { type, index } = contextMenuState;

      if (type === 'cue') {
        const originalName = deck.cuePoints[index]?.name;
        // Optimistic update
        updateCuePoint(deckId, index, { name });
        // Persist
        try {
          await analysisService.updateCuePoint(deck.trackId, index, { name });
          toast.success('Name updated');
        } catch (error) {
          console.error('[LibraryWaveform] Failed to update cue name:', error);
          // Rollback on failure
          if (originalName !== undefined) {
            updateCuePoint(deckId, index, { name: originalName });
          }
          toast.error('Failed to update name');
        }
      } else {
        const originalLoop = deck.loops.find((l) => l.index === index);
        const originalName = originalLoop?.name;
        // Optimistic update
        updateLoop(deckId, index, { name });
        // Persist
        try {
          await analysisService.updateLoop(deck.trackId, index, { name });
          toast.success('Name updated');
        } catch (error) {
          console.error('[LibraryWaveform] Failed to update loop name:', error);
          // Rollback on failure
          if (originalName !== undefined) {
            updateLoop(deckId, index, { name: originalName });
          }
          toast.error('Failed to update name');
        }
      }
    },
    [contextMenuState, deckId, deck.trackId, deck.cuePoints, deck.loops, updateCuePoint, updateLoop]
  );

  const handleContextMenuDelete = useCallback(async () => {
    if (!contextMenuState || !deck.trackId) return;

    const { type, index } = contextMenuState;

    if (type === 'cue') {
      // Store original for rollback
      const originalCue = deck.cuePoints[index];
      // Optimistic update
      removeCuePoint(deckId, index);
      // Persist
      try {
        await analysisService.deleteCuePoint(deck.trackId, index);
        toast.success(`Cue ${index + 1} deleted`);
      } catch (error) {
        console.error('[LibraryWaveform] Failed to delete cue:', error);
        // Rollback on failure
        if (originalCue) {
          addCuePoint(deckId, originalCue);
        }
        toast.error('Failed to delete cue');
      }
    } else {
      // Store original for rollback
      const originalLoop = deck.loops.find((l) => l.index === index);
      // Optimistic update
      removeLoop(deckId, index);
      // Persist
      try {
        await analysisService.deleteLoop(deck.trackId, index);
        toast.success(`Loop ${index + 1} deleted`);
      } catch (error) {
        console.error('[LibraryWaveform] Failed to delete loop:', error);
        // Rollback on failure
        if (originalLoop) {
          addLoop(deckId, originalLoop);
        }
        toast.error('Failed to delete loop');
      }
    }

    setContextMenuState(null);
  }, [contextMenuState, deckId, deck.trackId, deck.cuePoints, deck.loops, removeCuePoint, removeLoop, addCuePoint, addLoop]);

  // Loop control callbacks
  const handleSetLoopIn = useCallback((samplePosition: number) => {
    setPendingLoopInPoint(samplePosition);
  }, []);

  const handleSetLoopOut = useCallback(
    async (samplePosition: number) => {
      if (!deck.trackId) return;

      // Determine in-point (either pending or current position minus default length)
      const inPoint = pendingLoopInPoint ?? samplePosition;
      const outPoint = samplePosition;

      // Ensure out is after in
      if (outPoint <= inPoint) {
        toast.error('Loop out must be after loop in');
        return;
      }

      // Find next available loop slot
      const usedIndices = new Set(deck.loops.map((l) => l.index));
      let nextIndex = 0;
      while (usedIndices.has(nextIndex) && nextIndex < 8) {
        nextIndex++;
      }

      if (nextIndex >= 8) {
        toast.error('Maximum 8 loops reached');
        return;
      }

      const newLoop: LoopData = {
        index: nextIndex,
        inPoint,
        outPoint,
        color: getDefaultLoopColor(nextIndex),
        name: '',
        isActive: true,
      };

      // Optimistic update
      addLoop(deckId, newLoop);
      setActiveLoop(deckId, nextIndex);
      setPendingLoopInPoint(null);

      // Persist to database
      try {
        await analysisService.saveLoop(deck.trackId, newLoop);
        toast.success('Loop saved');
      } catch (error) {
        console.error('[LibraryWaveform] Failed to save loop:', error);
        removeLoop(deckId, nextIndex);
        toast.error('Failed to save loop');
      }
    },
    [deckId, deck.trackId, deck.loops, pendingLoopInPoint, addLoop, setActiveLoop, removeLoop]
  );

  const handleToggleLoop = useCallback(() => {
    // If there's an active loop, deactivate it by setting index to -1
    // If there's no active loop but loops exist, activate the first one
    if (deck.activeLoopIndex >= 0) {
      setActiveLoop(deckId, -1); // Deactivate loop
    } else if (deck.loops.length > 0) {
      setActiveLoop(deckId, deck.loops[0].index); // Activate first loop
    }
  }, [deckId, deck.activeLoopIndex, deck.loops, setActiveLoop]);

  const handleSetLoopLength = useCallback(
    async (beats: number) => {
      if (!deck.trackId || !deck.beatgridData) return;

      const samplesPerBeat = (60 / deck.bpm) * deck.sampleRate;
      const loopLength = Math.round(beats * samplesPerBeat);

      // Check if there's an active loop to resize
      const activeLoop = deck.activeLoopIndex >= 0
        ? deck.loops.find((l) => l.index === deck.activeLoopIndex)
        : null;

      if (activeLoop) {
        // RESIZE existing active loop - keep inPoint, update outPoint
        const newOutPoint = activeLoop.inPoint + loopLength;
        const originalOutPoint = activeLoop.outPoint;

        // Optimistic update
        updateLoop(deckId, activeLoop.index, { outPoint: newOutPoint });

        // Persist to database
        try {
          await analysisService.updateLoop(deck.trackId, activeLoop.index, { outPoint: newOutPoint });
        } catch (error) {
          console.error('[LibraryWaveform] Failed to resize loop:', error);
          // Rollback on failure
          updateLoop(deckId, activeLoop.index, { outPoint: originalOutPoint });
          toast.error('Failed to resize loop');
        }
      } else {
        // CREATE new loop at current position
        const currentSample = Math.round(playheadPosition * deck.duration * deck.sampleRate);
        const inPoint = currentSample;
        const outPoint = currentSample + loopLength;

        // Find next available loop slot
        const usedIndices = new Set(deck.loops.map((l) => l.index));
        let nextIndex = 0;
        while (usedIndices.has(nextIndex) && nextIndex < 8) {
          nextIndex++;
        }

        if (nextIndex >= 8) {
          toast.error('Maximum 8 loops reached');
          return;
        }

        const newLoop: LoopData = {
          index: nextIndex,
          inPoint,
          outPoint,
          color: getDefaultLoopColor(nextIndex),
          name: '',
          isActive: true,
        };

        // Optimistic update
        addLoop(deckId, newLoop);
        setActiveLoop(deckId, nextIndex);

        // Persist to database
        try {
          await analysisService.saveLoop(deck.trackId, newLoop);
          toast.success(`${beats} beat loop saved`);
        } catch (error) {
          console.error('[LibraryWaveform] Failed to save loop:', error);
          removeLoop(deckId, nextIndex);
          toast.error('Failed to save loop');
        }
      }
    },
    [deckId, deck.trackId, deck.beatgridData, deck.bpm, deck.sampleRate, deck.duration, deck.loops, deck.activeLoopIndex, playheadPosition, addLoop, setActiveLoop, removeLoop, updateLoop]
  );

  // Loop pad click handler - handles both hot and saved mode
  const handleLoopPadClick = useCallback(
    async (padIndex: number) => {
      if (!deck.trackId) return;

      const existingLoop = deck.loops.find((l) => l.index === padIndex);

      if (loopMode === 'saved') {
        // SAVED MODE: Click to jump to loop and activate
        if (existingLoop) {
          // Loop exists - seek to in-point and activate
          // First, set the new loop in the audio engine BEFORE seeking
          // This prevents the old loop from catching the seek
          if (DeckEngineService.isInitialized()) {
            DeckEngineService.setLoop(deckId, existingLoop.inPoint, existingLoop.outPoint);
            DeckEngineService.seek(deckId, existingLoop.inPoint);
          }
          const normalizedPosition = existingLoop.inPoint / (deck.duration * deck.sampleRate);
          setPosition(deckId, normalizedPosition);
          setActiveLoop(deckId, padIndex);
        } else {
          // No loop at this pad - create and save a new loop
          const currentSample = Math.round(playheadPosition * deck.duration * deck.sampleRate);
          const samplesPerBeat = (60 / deck.bpm) * deck.sampleRate;
          const loopLength = Math.round(4 * samplesPerBeat); // Default 4 beats

          const newLoop: LoopData = {
            index: padIndex,
            inPoint: currentSample,
            outPoint: currentSample + loopLength,
            color: getDefaultLoopColor(padIndex),
            name: '',
            isActive: true,
          };

          // Optimistic update
          addLoop(deckId, newLoop);
          setActiveLoop(deckId, padIndex);

          // Persist to database
          try {
            await analysisService.saveLoop(deck.trackId, newLoop);
            toast.success(`Loop ${padIndex + 1} saved`);
          } catch (error) {
            console.error('[LibraryWaveform] Failed to save loop:', error);
            removeLoop(deckId, padIndex);
            toast.error('Failed to save loop');
          }
        }
      } else {
        // HOT MODE: Press to activate loop immediately
        if (existingLoop) {
          // Loop exists - seek to in-point and activate
          // First, set the new loop in the audio engine BEFORE seeking
          // This prevents the old loop from catching the seek
          if (DeckEngineService.isInitialized()) {
            DeckEngineService.setLoop(deckId, existingLoop.inPoint, existingLoop.outPoint);
            DeckEngineService.seek(deckId, existingLoop.inPoint);
          }
          const normalizedPosition = existingLoop.inPoint / (deck.duration * deck.sampleRate);
          setPosition(deckId, normalizedPosition);
          setActiveLoop(deckId, padIndex);
        } else {
          // No loop at this pad - create temporary hot loop at current position
          const currentSample = Math.round(playheadPosition * deck.duration * deck.sampleRate);
          const samplesPerBeat = (60 / deck.bpm) * deck.sampleRate;
          const loopLength = Math.round(4 * samplesPerBeat); // Default 4 beats

          const newLoop: LoopData = {
            index: padIndex,
            inPoint: currentSample,
            outPoint: currentSample + loopLength,
            color: getDefaultLoopColor(padIndex),
            name: '',
            isActive: true,
          };

          // Add to store (not persisted until converted to saved)
          addLoop(deckId, newLoop);
          setActiveLoop(deckId, padIndex);
        }
      }
    },
    [deckId, deck.trackId, deck.loops, deck.duration, deck.sampleRate, deck.bpm, loopMode, playheadPosition, addLoop, setActiveLoop, removeLoop, setPosition]
  );

  // Loop pad release handler - for hot loop mode only
  const handleLoopPadRelease = useCallback(
    (padIndex: number) => {
      if (loopMode !== 'hot') return;

      // Only deactivate if this is the currently active loop
      if (deck.activeLoopIndex === padIndex) {
        setActiveLoop(deckId, -1); // Deactivate loop
      }
    },
    [deckId, deck.activeLoopIndex, loopMode, setActiveLoop]
  );

  // Loop mode toggle handler
  const handleLoopModeChange = useCallback(
    (mode: LoopMode) => {
      setLoopMode(deckId, mode);
    },
    [deckId, setLoopMode]
  );

  // Stem control callbacks
  const handleStemMuteToggle = useCallback(
    (stemType: StemType) => {
      toggleStemMute(deckId, stemType);
    },
    [deckId, toggleStemMute]
  );

  const handleStemSoloToggle = useCallback(
    (stemType: StemType) => {
      toggleStemSolo(deckId, stemType);
    },
    [deckId, toggleStemSolo]
  );

  const handleAnalyzeStems = useCallback(async () => {
    if (!deck.trackId) return;

    // Get the audio file to analyze
    const file = await import('../services/file-handle-store').then(
      (m) => m.getFileWithPermission(deck.trackId!)
    );

    if (!file) {
      toast.error('Cannot access audio file for stem analysis');
      return;
    }

    // Decode audio
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Start analysis
    setStemAnalyzing(deckId, true);

    try {
      await stemsService.analyzeStems(deck.trackId, audioBuffer, {
        onProgress: (progress) => {
          setStemProgress(deckId, progress.progress, progress.stage);
        },
        onComplete: (result) => {
          // Convert ArrayBuffers to AudioBuffers
          const stemBuffers = StemsService.createStemBuffers(result, audioContext);
          setStemBuffers(deckId, stemBuffers);
          toast.success('Stem separation complete');
        },
        onError: (error) => {
          setStemAnalyzing(deckId, false);
          toast.error(`Stem analysis failed: ${error.message}`);
        },
      });
    } catch (error) {
      setStemAnalyzing(deckId, false);
      toast.error('Failed to start stem analysis');
      console.error('[LibraryWaveform] Stem analysis error:', error);
    }
  }, [deckId, deck.trackId, setStemAnalyzing, setStemProgress, setStemBuffers]);

  const handleCancelStemAnalysis = useCallback(() => {
    if (deck.trackId) {
      stemsService.cancelAnalysis(deck.trackId);
      setStemAnalyzing(deckId, false);
    }
  }, [deckId, deck.trackId, setStemAnalyzing]);

  // Clear stems action
  const clearStems = useAudioStore((s) => s.clearStems);
  const handleClearStems = useCallback(() => {
    clearStems(deckId);
  }, [deckId, clearStems]);

  // Get active loop data
  const activeLoop = deck.activeLoopIndex >= 0
    ? deck.loops.find((l) => l.index === deck.activeLoopIndex) ?? null
    : null;

  // Calculate samples per beat for loop length display
  const samplesPerBeat = deck.sampleRate > 0 && deck.bpm > 0
    ? (60 / deck.bpm) * deck.sampleRate
    : 22050; // Default fallback

  // Current position in samples
  const currentPositionSamples = Math.round(playheadPosition * deck.duration * deck.sampleRate);

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
    // Stop playback in engine first
    if (DeckEngineService.isInitialized()) {
      DeckEngineService.ejectTrack(deckId);
    }
    ejectTrack(deckId);
  }, [deckId]);

  // Sync active loop with audio engine
  useEffect(() => {
    if (!DeckEngineService.isInitialized()) return;

    if (deck.activeLoopIndex >= 0) {
      const activeLoopData = deck.loops.find((l) => l.index === deck.activeLoopIndex);
      if (activeLoopData) {
        DeckEngineService.setLoop(deckId, activeLoopData.inPoint, activeLoopData.outPoint);
      }
    } else {
      DeckEngineService.clearLoop(deckId);
    }
  }, [deckId, deck.activeLoopIndex, deck.loops]);

  return (
    <div
      className={`deck-ui bg-[#121212] border border-[#4DFA90]/30 rounded-sm overflow-hidden ${className}`}
    >
      {/* Header with Track Info */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#4DFA90]/20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-2xl font-bold text-[#4DFA90] flex-shrink-0">{deckId}</span>
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              deck.isPlaying ? 'bg-[#4DFA90] animate-pulse' : 'bg-[#4DFA90]/30'
            }`}
          />
          {hasTrack ? (
            <>
              <span className="text-[#4DFA90]/30 flex-shrink-0">|</span>
              <span className="text-sm font-semibold truncate">{deck.title || 'Unknown Title'}</span>
              <span className="text-[#4DFA90]/40 flex-shrink-0">—</span>
              <span className="text-sm text-[#4DFA90]/60 truncate">{deck.artist || 'Unknown Artist'}</span>
              <span className="text-[#4DFA90]/40 flex-shrink-0">•</span>
              <span className="text-xs font-mono text-[#4DFA90]/80 flex-shrink-0">{deck.bpm.toFixed(1)} BPM</span>
              <span className="text-[#4DFA90]/40 flex-shrink-0">•</span>
              <span className="text-xs font-mono text-[#4DFA90]/80 flex-shrink-0">{formatDuration(deck.duration)}</span>
            </>
          ) : (
            <span className="text-[#4DFA90]/40 text-sm italic">Double-click a track to load</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasTrack && (
            <button
              onClick={handlePlayPause}
              className="px-3 py-1 text-xs font-mono uppercase bg-[#000] border border-[#4DFA90]/30 rounded hover:border-[#4DFA90] hover:bg-[#4DFA90]/10 transition-colors"
              title={deck.isPlaying ? 'Pause' : 'Play'}
            >
              {deck.isPlaying ? '||' : '\u25B6'}
            </button>
          )}
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
          cuePoints={deck.cuePoints}
          loops={deck.loops}
          totalSamples={Math.round(deck.duration * deck.sampleRate)}
          activeLoopIndex={deck.activeLoopIndex}
          onLoopClick={handleWaveformLoopClick}
          onLoopContextMenu={handleLoopContextMenu}
          onCueClick={handleWaveformCueClick}
          onCueContextMenu={handlePadContextMenu}
        />
      </div>

      {/* Detail Waveform */}
      <div className="px-4 pb-2">
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
          cuePoints={deck.cuePoints}
          loops={deck.loops}
          onCueContextMenu={handlePadContextMenu}
          onLoopClick={handleWaveformLoopClick}
          onLoopContextMenu={handleLoopContextMenu}
        />
      </div>

      {/* Performance Pads */}
      {hasTrack && (
        <div className="px-4 pb-2">
          <div className="text-xs font-mono text-[#4DFA90]/60 mb-1">HOT CUES</div>
          <PerformancePads
            cuePoints={deck.cuePoints}
            onPadClick={handlePadClick}
            onPadContextMenu={handlePadContextMenu}
            keyboardEnabled={true}
          />
        </div>
      )}

      {/* Loop Pads */}
      {hasTrack && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-mono text-[#4DFA90]/60">LOOP PADS</div>
            <LoopModeToggle
              mode={loopMode}
              onModeChange={handleLoopModeChange}
              keyboardEnabled={true}
            />
          </div>
          <LoopPads
            loops={deck.loops}
            activeLoopIndex={deck.activeLoopIndex}
            loopMode={loopMode}
            onPadClick={handleLoopPadClick}
            onPadRelease={handleLoopPadRelease}
            onPadContextMenu={handleLoopContextMenu}
            keyboardEnabled={true}
          />
        </div>
      )}

      {/* Loop Controls */}
      {hasTrack && (
        <div className="px-4 pb-4">
          <div className="text-xs font-mono text-[#4DFA90]/60 mb-1">LOOP</div>
          <LoopControls
            activeLoop={activeLoop}
            loops={deck.loops}
            currentPositionSamples={currentPositionSamples}
            samplesPerBeat={samplesPerBeat}
            bpm={deck.bpm}
            onSetLoopIn={handleSetLoopIn}
            onSetLoopOut={handleSetLoopOut}
            onToggleLoop={handleToggleLoop}
            onSetLoopLength={handleSetLoopLength}
            onLoopContextMenu={handleLoopContextMenu}
            keyboardEnabled={true}
          />
        </div>
      )}

      {/* Stem Controls */}
      {hasTrack && (
        <div className="px-4 pb-4">
          <div className="text-xs font-mono text-[#4DFA90]/60 mb-1">STEMS</div>
          <StemControls
            stemState={stemState}
            hasWebGPU={hasWebGPU}
            webGPUUnavailableReason={webGPUUnavailableReason}
            onToggleMute={handleStemMuteToggle}
            onToggleSolo={handleStemSoloToggle}
            onAnalyzeStems={handleAnalyzeStems}
            onCancelAnalysis={handleCancelStemAnalysis}
            onClearStems={handleClearStems}
            keyboardEnabled={true}
          />
        </div>
      )}

      {/* Context Menu for Cue/Loop Management */}
      <CueContextMenu
        isOpen={contextMenuState !== null}
        position={contextMenuState ? { x: contextMenuState.x, y: contextMenuState.y } : { x: 0, y: 0 }}
        type={contextMenuState?.type ?? 'cue'}
        cueData={contextMenuState?.type === 'cue' ? deck.cuePoints[contextMenuState.index] : undefined}
        loopData={contextMenuState?.type === 'loop' ? deck.loops.find((l) => l.index === contextMenuState.index) : undefined}
        onColorChange={handleContextMenuColorChange}
        onNameChange={handleContextMenuNameChange}
        onDelete={handleContextMenuDelete}
        onClose={handleCloseContextMenu}
      />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
