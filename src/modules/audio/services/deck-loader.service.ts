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
import {
  analyzeTrack as runTrackAnalysis,
  serializeBeatgrid,
  deserializeBeatgrid,
  type TrackAnalysisResult,
} from '../analysis/track-analyzer';
import { detectTransients } from '../utils/transient-detector';
import { analysisService } from './analysis.service';
import { stemsCacheService } from './stems-cache.service';
import { DeckEngineService } from './deck-engine.service';
import { useAudioStore } from '../store/audio.store';
import type { DeckId, TrackAnalysisProgress } from '../types';
import { getFileWithPermission } from '../../library/services/file-handle-store';

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
      sampleRate,
    });

    // 3. Get mono samples for analysis
    const samples = getMonoSamples(audioBuffer);

    // 4. Analyze waveform
    const analyzer = new WaveformAnalyzer();
    const waveformData = analyzer.analyzeBuffer(samples, sampleRate);

    // 5. Update store with waveform data
    store.setWaveformData(deckId, waveformData);

    // 5.5. Load audio buffer into DeckEngineService for playback
    if (!DeckEngineService.isInitialized()) {
      await DeckEngineService.initialize();
    }
    await DeckEngineService.loadTrack(deckId, audioBuffer, metadata?.id || Date.now());

    // 6. Detect transients for magnetic snap functionality
    const transients = detectTransients(waveformData);
    store.setTransients(deckId, transients);

    // 7. Clear analyzing state on successful completion
    store.setAnalyzing(deckId, false);
  } catch (error) {
    console.error(`[DeckLoader] Failed to load track to deck ${deckId}:`, error);
    store.setAnalyzing(deckId, false);
    throw error;
  }
}

/**
 * Load beatgrid data from database for a deck.
 * Called after track is loaded to add beatgrid overlay.
 */
async function loadBeatgridForDeck(deckId: DeckId, trackId: number): Promise<void> {
  try {
    const beatgridBytes = await analysisService.getBeatgrid(trackId);
    if (beatgridBytes) {
      const beatgridData = deserializeBeatgrid(beatgridBytes);
      const store = useAudioStore.getState();
      store.setBeatgridData(deckId, beatgridData);
      console.log(`[DeckLoader] Loaded beatgrid for track ${trackId}: ${beatgridData.beatCount} beats at ${beatgridData.bpm.toFixed(1)} BPM`);
    } else {
      // No beatgrid data for this track - graceful fallback (overlay won't render)
      console.debug(`[DeckLoader] No beatgrid data for track ${trackId} - track may not have been analyzed yet`);
    }
  } catch (error) {
    console.warn(`[DeckLoader] Failed to load beatgrid for track ${trackId}:`, error);
  }
}

/**
 * Load cue points and loops from database for a deck.
 * Called after track is loaded to show cue/loop markers.
 */
async function loadCueLoopDataForDeck(deckId: DeckId, trackId: number): Promise<void> {
  const store = useAudioStore.getState();

  try {
    // Load cue points
    const cuePoints = await analysisService.getCuePoints(trackId);
    if (cuePoints.length > 0) {
      // Merge loaded cues into the 8-pad array
      const currentCues = [...store.decks[deckId].cuePoints];
      for (const cue of cuePoints) {
        if (cue.index >= 0 && cue.index < 8) {
          currentCues[cue.index] = cue;
        }
      }
      store.setCuePoints(deckId, currentCues);
      console.log(`[DeckLoader] Loaded ${cuePoints.length} cue points for track ${trackId}`);
    }
  } catch (error) {
    console.warn(`[DeckLoader] Failed to load cue points for track ${trackId}:`, error);
  }

  try {
    // Load loops
    const loops = await analysisService.getLoops(trackId);
    if (loops.length > 0) {
      store.setLoops(deckId, loops);
      console.log(`[DeckLoader] Loaded ${loops.length} loops for track ${trackId}`);
    }
  } catch (error) {
    console.warn(`[DeckLoader] Failed to load loops for track ${trackId}:`, error);
  }
}

/**
 * Load cached stems for a deck if available.
 * Called after track is loaded to check if stems are already analyzed.
 */
async function loadStemsForDeck(deckId: DeckId, trackId: number): Promise<void> {
  const store = useAudioStore.getState();

  try {
    // Check if stems are cached for this track
    const cacheStatus = await stemsCacheService.getCacheStatus(trackId);

    if (cacheStatus.cached) {
      console.log(`[DeckLoader] Found cached stems for track ${trackId}, loading...`);

      // We need to get the audio file to generate hash for retrieval
      const file = await getFileWithPermission(trackId);
      if (!file) {
        console.warn(`[DeckLoader] Cannot load stems - file not accessible`);
        return;
      }

      // Decode to get AudioBuffer for hash generation
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

      // Generate hash and retrieve cached stems
      const audioHash = await stemsCacheService.generateAudioHash(audioBuffer);
      const cached = await stemsCacheService.getCachedStems(trackId, audioHash);

      if (cached) {
        // Convert cached ArrayBuffers to AudioBuffers
        const stemBuffers = {
          vocals: createStemAudioBuffer(cached.stems.vocals, cached.sampleRate, ctx),
          drums: createStemAudioBuffer(cached.stems.drums, cached.sampleRate, ctx),
          bass: createStemAudioBuffer(cached.stems.bass, cached.sampleRate, ctx),
          other: createStemAudioBuffer(cached.stems.other, cached.sampleRate, ctx),
        };

        store.setStemBuffers(deckId, stemBuffers);
        console.log(`[DeckLoader] Loaded cached stems for track ${trackId}`);
      }
    }
  } catch (error) {
    console.warn(`[DeckLoader] Failed to load stems for track ${trackId}:`, error);
  }
}

/**
 * Helper to create AudioBuffer from stem ArrayBuffer.
 */
function createStemAudioBuffer(
  data: ArrayBuffer,
  sampleRate: number,
  audioContext: AudioContext
): AudioBuffer | null {
  if (data.byteLength === 0) return null;
  const float32 = new Float32Array(data);
  const buffer = audioContext.createBuffer(1, float32.length, sampleRate);
  buffer.copyToChannel(float32, 0);
  return buffer;
}

/**
 * Load a track from the library into a deck using stored file handle.
 * Falls back to file picker if handle is unavailable or permission denied.
 */
export async function loadTrackFromLibrary(
  deckId: DeckId,
  track: {
    id: number;
    title: string;
    artist: string;
    bpm: number;
    duration: number;
  }
): Promise<void> {
  console.log(`[DeckLoader] Loading track ${track.id}: ${track.title}`);

  // Try to get the file from stored handle
  const file = await getFileWithPermission(track.id);
  console.log(`[DeckLoader] getFileWithPermission result:`, file ? file.name : 'null');

  if (file) {
    // Successfully got file from stored handle
    await loadTrackToDeck(deckId, file, {
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
      duration: track.duration,
    });

    // Load beatgrid, cue/loop data, and cached stems from database if available
    await loadBeatgridForDeck(deckId, track.id);
    await loadCueLoopDataForDeck(deckId, track.id);
    await loadStemsForDeck(deckId, track.id);
    return;
  }

  // Handle not found or permission denied - fall back to file picker
  console.warn(`[DeckLoader] No stored handle for track ${track.id}, falling back to file picker`);

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

    const pickedFile = await fileHandle.getFile();
    await loadTrackToDeck(deckId, pickedFile, {
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
      duration: track.duration,
    });

    // Load beatgrid, cue/loop data, and cached stems from database if available
    await loadBeatgridForDeck(deckId, track.id);
    await loadCueLoopDataForDeck(deckId, track.id);
    await loadStemsForDeck(deckId, track.id);
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return;
    }
    throw error;
  }
}

/**
 * Open a file picker and load the selected audio file into a deck.
 *
 * Note: Tracks loaded via file picker do NOT have a trackId from the library,
 * so beatgrid, cue points, loops, and stems cannot be loaded from the database.
 * This is expected behavior - only library tracks have persisted performance data.
 * Users should import tracks to the library first for full functionality.
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

/**
 * Analyze a track for BPM, Key, and Beatgrid.
 * Results are stored in the database.
 *
 * @param trackId - The track ID to analyze
 * @param file - The audio file to analyze
 * @param onProgress - Optional progress callback
 * @returns Analysis results
 */
export async function analyzeTrack(
  trackId: number,
  file: File,
  onProgress?: (progress: TrackAnalysisProgress) => void
): Promise<TrackAnalysisResult> {
  onProgress?.({ trackId, progress: 0, stage: 'decoding' });

  // 1. Decode audio file
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  onProgress?.({ trackId, progress: 0.2, stage: 'decoding' });

  const sampleRate = audioBuffer.sampleRate;

  // 2. Get mono samples for analysis
  const samples = getMonoSamples(audioBuffer);

  // 3. Run full track analysis (BPM, Key, Beatgrid)
  const progressCallback = (progress: number, stage: 'decoding' | 'analyzing' | 'storing') => {
    onProgress?.({ trackId, progress, stage });
  };

  const analysisResult = await runTrackAnalysis(samples, sampleRate, progressCallback);

  onProgress?.({ trackId, progress: 0.85, stage: 'storing' });

  // 4. Serialize beatgrid for storage
  const beatgridData = serializeBeatgrid(analysisResult.beatgrid);

  // 5. Store results in database
  await analysisService.storeAnalysisResults(
    trackId,
    analysisResult.bpm.bpm,
    analysisResult.key.camelot,
    beatgridData
  );

  onProgress?.({ trackId, progress: 1, stage: 'storing' });

  return analysisResult;
}

/**
 * Analyze a track from the library by ID.
 * Retrieves the file from stored handle and runs analysis.
 */
export async function analyzeTrackFromLibrary(
  trackId: number,
  onProgress?: (progress: TrackAnalysisProgress) => void
): Promise<TrackAnalysisResult | null> {
  const file = await getFileWithPermission(trackId);

  if (!file) {
    console.warn(`[DeckLoader] Cannot analyze track ${trackId}: file not accessible`);
    return null;
  }

  return analyzeTrack(trackId, file, onProgress);
}

/**
 * Pre-initialize audio analyzer libraries.
 * No-op since music-tempo and keyfinder-js don't require initialization.
 * @deprecated No longer needed - kept for API compatibility
 */
export async function warmupAnalyzer(): Promise<void> {
  // No warmup needed for music-tempo or keyfinder-js
}

/**
 * Check if a track has already been analyzed.
 */
export async function isTrackAnalyzed(trackId: number): Promise<boolean> {
  return analysisService.isTrackAnalyzed(trackId);
}

/**
 * Get list of tracks that need analysis.
 */
export async function getUnanalyzedTracks(): Promise<number[]> {
  return analysisService.getUnanalyzedTracks();
}

// Re-export for convenience
export { useAudioStore };
