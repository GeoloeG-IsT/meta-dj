/**
 * DeckLoader Service - Load and analyze audio tracks for deck playback
 *
 * Handles:
 * - Loading audio files (from File picker or library)
 * - Decoding audio to samples
 * - Running waveform analysis
 * - Updating deck state
 */

import { WaveformAnalyzer } from '../analysis/waveform-analyzer';
import { useAudioStore } from '../store/audio.store';
import type { DeckId } from '../types';

// Shared AudioContext for decoding (created lazily)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export interface TrackMetadata {
  id?: number;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
}

/**
 * Load an audio file into a deck and analyze its waveform.
 */
export async function loadTrackToDeck(
  deckId: DeckId,
  file: File,
  metadata?: Partial<TrackMetadata>
): Promise<void> {
  const store = useAudioStore.getState();

  // Extract metadata from filename if not provided
  const title = metadata?.title || file.name.replace(/\.[^/.]+$/, '');
  const artist = metadata?.artist || 'Unknown Artist';
  const bpm = metadata?.bpm || 120;

  // Set analyzing state
  store.setAnalyzing(deckId, true);

  try {
    // 1. Decode audio file
    const arrayBuffer = await file.arrayBuffer();
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;

    // 2. Load track metadata into store
    store.loadTrack(deckId, metadata?.id || Date.now(), {
      title,
      artist,
      bpm,
      duration,
    });

    // 3. Get mono samples for analysis
    const samples = getMonoSamples(audioBuffer);

    // 4. Analyze waveform
    const analyzer = new WaveformAnalyzer();
    const waveformData = analyzer.analyzeBuffer(samples, sampleRate);

    // 5. Update store with waveform data
    store.setWaveformData(deckId, waveformData);
  } catch (error) {
    console.error(`[DeckLoader] Failed to load track to deck ${deckId}:`, error);
    store.setAnalyzing(deckId, false);
    throw error;
  }
}

/**
 * Open a file picker and load the selected audio file into a deck.
 */
export async function pickAndLoadTrack(deckId: DeckId): Promise<void> {
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Audio Files',
          accept: {
            'audio/*': ['.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'],
          },
        },
      ],
      multiple: false,
    });

    const file = await fileHandle.getFile();
    await loadTrackToDeck(deckId, file);
  } catch (error) {
    // User cancelled the picker
    if ((error as Error).name === 'AbortError') {
      return;
    }
    throw error;
  }
}

/**
 * Eject the current track from a deck.
 */
export function ejectTrack(deckId: DeckId): void {
  const store = useAudioStore.getState();
  store.ejectTrack(deckId);
}

/**
 * Convert an AudioBuffer to mono Float32Array samples.
 */
function getMonoSamples(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  // Mix down to mono
  const mono = new Float32Array(length);
  const scale = 1 / numChannels;

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] * scale;
    }
  }

  return mono;
}

// Re-export for convenience
export { useAudioStore };
