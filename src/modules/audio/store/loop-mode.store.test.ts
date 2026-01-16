/**
 * Loop Mode State Management Tests
 *
 * Tests for loop mode state management in audio store.
 * Story 5.6: Implement 8-Loop System (Hot Loops + Saved Loops)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioStore } from './audio.store';
import type { DeckState } from './audio.store';
import { createInitialStemState } from '../types/stems';

// Create a minimal deck state for testing
const createTestDeckState = (): DeckState => ({
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
  transients: [],
  slipMode: {
    isActive: false,
    currentOffset: 0,
    startX: 0,
    originalFirstBeat: 0,
    snappedBeatIndex: null,
    isSnapped: false,
  },
  isAnalyzing: false,
  zoomLevel: 4,
  cuePoints: [],
  loops: [],
  activeLoopIndex: -1,
  loopMode: 'saved',
  stems: createInitialStemState(),
});

describe('Loop Mode State Management', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAudioStore.setState({
      decks: {
        A: createTestDeckState(),
        B: createTestDeckState(),
        C: createTestDeckState(),
        D: createTestDeckState(),
      },
    });
  });

  describe('initial state', () => {
    it('should have "saved" as the default loop mode', () => {
      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('saved');
      expect(state.decks.B.loopMode).toBe('saved');
    });
  });

  describe('setLoopMode', () => {
    it('should set loop mode to "hot"', () => {
      const { setLoopMode } = useAudioStore.getState();

      setLoopMode('A', 'hot');

      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('hot');
    });

    it('should set loop mode to "saved"', () => {
      // First set to hot
      useAudioStore.getState().setLoopMode('A', 'hot');
      expect(useAudioStore.getState().decks.A.loopMode).toBe('hot');

      // Then set back to saved
      useAudioStore.getState().setLoopMode('A', 'saved');
      expect(useAudioStore.getState().decks.A.loopMode).toBe('saved');
    });

    it('should only affect the specified deck', () => {
      const { setLoopMode } = useAudioStore.getState();

      setLoopMode('A', 'hot');

      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('hot');
      expect(state.decks.B.loopMode).toBe('saved');
      expect(state.decks.C.loopMode).toBe('saved');
      expect(state.decks.D.loopMode).toBe('saved');
    });

    it('should allow different modes on different decks', () => {
      const { setLoopMode } = useAudioStore.getState();

      setLoopMode('A', 'hot');
      setLoopMode('B', 'saved');
      setLoopMode('C', 'hot');

      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('hot');
      expect(state.decks.B.loopMode).toBe('saved');
      expect(state.decks.C.loopMode).toBe('hot');
      expect(state.decks.D.loopMode).toBe('saved');
    });
  });

  describe('selectLoopMode selector', () => {
    it('should return the correct loop mode for a deck', () => {
      const { setLoopMode } = useAudioStore.getState();
      setLoopMode('A', 'hot');

      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('hot');
    });
  });

  describe('loop mode with active loops', () => {
    it('should maintain loop mode independently of active loops', () => {
      const { setLoopMode, addLoop, setActiveLoop } = useAudioStore.getState();

      // Add a loop
      addLoop('A', {
        index: 0,
        inPoint: 44100,
        outPoint: 88200,
        color: 'green',
        name: 'Test Loop',
        isActive: false,
      });

      // Set active loop
      setActiveLoop('A', 0);

      // Change loop mode
      setLoopMode('A', 'hot');

      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('hot');
      expect(state.decks.A.activeLoopIndex).toBe(0);
      expect(state.decks.A.loops[0].isActive).toBe(true);
    });

    it('should preserve loop mode when deactivating loops', () => {
      const { setLoopMode, addLoop, setActiveLoop } = useAudioStore.getState();

      // Set hot mode
      setLoopMode('A', 'hot');

      // Add and activate a loop
      addLoop('A', {
        index: 0,
        inPoint: 44100,
        outPoint: 88200,
        color: 'green',
        name: '',
        isActive: false,
      });
      setActiveLoop('A', 0);

      // Deactivate loop
      setActiveLoop('A', -1);

      const state = useAudioStore.getState();
      expect(state.decks.A.loopMode).toBe('hot');
      expect(state.decks.A.activeLoopIndex).toBe(-1);
    });
  });
});
