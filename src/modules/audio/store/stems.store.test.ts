/**
 * Stem State Management Tests
 *
 * Tests for stem-related state management in audio store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioStore } from './audio.store';
import { createInitialStemState } from '../types/stems';
import type { StemBuffers, StemType } from '../types/stems';

describe('Stem State Management', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAudioStore.setState({
      decks: {
        A: {
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
          stems: createInitialStemState(),
        },
        B: {
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
          stems: createInitialStemState(),
        },
        C: {
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
          stems: createInitialStemState(),
        },
        D: {
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
          stems: createInitialStemState(),
        },
      },
    });
  });

  describe('Initial State', () => {
    it('should have initial stem state with all stems unmuted and no solo', () => {
      const state = useAudioStore.getState();
      const stems = state.decks.A.stems;

      expect(stems.available).toBe(false);
      expect(stems.analyzing).toBe(false);
      expect(stems.progress).toBe(0);
      expect(stems.stage).toBeNull();
      expect(stems.muted.vocals).toBe(false);
      expect(stems.muted.drums).toBe(false);
      expect(stems.muted.bass).toBe(false);
      expect(stems.muted.other).toBe(false);
      expect(stems.solo).toBeNull();
    });
  });

  describe('setStemBuffers', () => {
    it('should set stem buffers and mark stems as available', () => {
      const mockBuffers: StemBuffers = {
        vocals: {} as AudioBuffer,
        drums: {} as AudioBuffer,
        bass: {} as AudioBuffer,
        other: {} as AudioBuffer,
      };

      useAudioStore.getState().setStemBuffers('A', mockBuffers);

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.available).toBe(true);
      expect(state.decks.A.stems.analyzing).toBe(false);
      expect(state.decks.A.stems.progress).toBe(100);
      expect(state.decks.A.stems.buffers).toEqual(mockBuffers);
    });
  });

  describe('setStemProgress', () => {
    it('should update progress and stage', () => {
      useAudioStore.getState().setStemProgress('A', 50, 'inference');

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.progress).toBe(50);
      expect(state.decks.A.stems.stage).toBe('inference');
    });
  });

  describe('setStemAnalyzing', () => {
    it('should set analyzing state and reset progress when starting', () => {
      useAudioStore.getState().setStemAnalyzing('A', true);

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.analyzing).toBe(true);
      expect(state.decks.A.stems.progress).toBe(0);
      expect(state.decks.A.stems.stage).toBe('loading_model');
    });

    it('should clear analyzing state when stopping', () => {
      // First start analyzing
      useAudioStore.getState().setStemAnalyzing('A', true);
      useAudioStore.getState().setStemProgress('A', 75, 'inference');

      // Then stop
      useAudioStore.getState().setStemAnalyzing('A', false);

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.analyzing).toBe(false);
      expect(state.decks.A.stems.progress).toBe(75); // Progress preserved
      expect(state.decks.A.stems.stage).toBeNull();
    });
  });

  describe('toggleStemMute', () => {
    it('should toggle mute state for a stem', () => {
      // Initially unmuted
      expect(useAudioStore.getState().decks.A.stems.muted.vocals).toBe(false);

      // Toggle to muted
      useAudioStore.getState().toggleStemMute('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.muted.vocals).toBe(true);

      // Toggle back to unmuted
      useAudioStore.getState().toggleStemMute('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.muted.vocals).toBe(false);
    });

    it('should only affect the specified stem', () => {
      useAudioStore.getState().toggleStemMute('A', 'drums');

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.muted.vocals).toBe(false);
      expect(state.decks.A.stems.muted.drums).toBe(true);
      expect(state.decks.A.stems.muted.bass).toBe(false);
      expect(state.decks.A.stems.muted.other).toBe(false);
    });
  });

  describe('toggleStemSolo', () => {
    it('should set solo state when toggling a stem', () => {
      useAudioStore.getState().toggleStemSolo('A', 'vocals');

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.solo).toBe('vocals');
    });

    it('should clear solo when toggling the same stem again', () => {
      // Solo vocals
      useAudioStore.getState().toggleStemSolo('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.solo).toBe('vocals');

      // Toggle again to unsolo
      useAudioStore.getState().toggleStemSolo('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.solo).toBeNull();
    });

    it('should switch solo to different stem', () => {
      // Solo vocals
      useAudioStore.getState().toggleStemSolo('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.solo).toBe('vocals');

      // Solo drums instead
      useAudioStore.getState().toggleStemSolo('A', 'drums');
      expect(useAudioStore.getState().decks.A.stems.solo).toBe('drums');
    });

    it('should unmute the soloed stem', () => {
      // First mute vocals
      useAudioStore.getState().toggleStemMute('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.muted.vocals).toBe(true);

      // Then solo vocals - should unmute
      useAudioStore.getState().toggleStemSolo('A', 'vocals');
      expect(useAudioStore.getState().decks.A.stems.muted.vocals).toBe(false);
      expect(useAudioStore.getState().decks.A.stems.solo).toBe('vocals');
    });
  });

  describe('clearStems', () => {
    it('should reset stems to initial state', () => {
      const mockBuffers: StemBuffers = {
        vocals: {} as AudioBuffer,
        drums: {} as AudioBuffer,
        bass: {} as AudioBuffer,
        other: {} as AudioBuffer,
      };

      // Set up stems
      useAudioStore.getState().setStemBuffers('A', mockBuffers);
      useAudioStore.getState().toggleStemMute('A', 'vocals');
      useAudioStore.getState().toggleStemSolo('A', 'drums');

      // Clear
      useAudioStore.getState().clearStems('A');

      const state = useAudioStore.getState();
      expect(state.decks.A.stems.available).toBe(false);
      expect(state.decks.A.stems.muted.vocals).toBe(false);
      expect(state.decks.A.stems.solo).toBeNull();
      expect(state.decks.A.stems.buffers.vocals).toBeNull();
    });
  });

  describe('Deck Independence', () => {
    it('should maintain independent stem state per deck', () => {
      // Set stems for deck A
      useAudioStore.getState().setStemBuffers('A', {
        vocals: {} as AudioBuffer,
        drums: null,
        bass: null,
        other: null,
      });
      useAudioStore.getState().toggleStemMute('A', 'vocals');

      // Set stems for deck B differently
      useAudioStore.getState().setStemAnalyzing('B', true);

      const state = useAudioStore.getState();

      // Deck A should have stems available and vocals muted
      expect(state.decks.A.stems.available).toBe(true);
      expect(state.decks.A.stems.muted.vocals).toBe(true);
      expect(state.decks.A.stems.analyzing).toBe(false);

      // Deck B should be analyzing with no mutes
      expect(state.decks.B.stems.available).toBe(false);
      expect(state.decks.B.stems.muted.vocals).toBe(false);
      expect(state.decks.B.stems.analyzing).toBe(true);
    });
  });

  describe('Mute/Solo Logic', () => {
    it('should handle complex mute/solo interactions correctly', () => {
      // Scenario: Mute vocals and drums, then solo bass

      // Mute vocals and drums
      useAudioStore.getState().toggleStemMute('A', 'vocals');
      useAudioStore.getState().toggleStemMute('A', 'drums');

      let state = useAudioStore.getState();
      expect(state.decks.A.stems.muted.vocals).toBe(true);
      expect(state.decks.A.stems.muted.drums).toBe(true);
      expect(state.decks.A.stems.muted.bass).toBe(false);
      expect(state.decks.A.stems.muted.other).toBe(false);
      expect(state.decks.A.stems.solo).toBeNull();

      // Now solo bass - mutes should remain, but solo takes precedence
      useAudioStore.getState().toggleStemSolo('A', 'bass');

      state = useAudioStore.getState();
      expect(state.decks.A.stems.solo).toBe('bass');
      // Mute states preserved
      expect(state.decks.A.stems.muted.vocals).toBe(true);
      expect(state.decks.A.stems.muted.drums).toBe(true);
      expect(state.decks.A.stems.muted.bass).toBe(false);
    });
  });
});
