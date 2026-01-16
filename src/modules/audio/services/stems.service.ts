/**
 * Stems Service
 *
 * Manages the stems worker lifecycle and provides a clean API for stem separation.
 * Handles communication between main thread and stems worker.
 */

import { EventType } from '../../../shared/types/messaging';
import type {
  StemAnalyzeRequest,
  StemAnalyzeProgress,
  StemAnalyzeComplete,
  StemAnalyzeError,
  StemModelLoading,
  StemModelReady,
  StemBuffers,
} from '../types/stems';

export type StemsProgressCallback = (progress: StemAnalyzeProgress) => void;
export type StemsCompleteCallback = (result: StemAnalyzeComplete) => void;
export type StemsErrorCallback = (error: StemAnalyzeError) => void;
export type ModelLoadingCallback = (progress: StemModelLoading) => void;
export type ModelReadyCallback = (info: StemModelReady) => void;

interface AnalysisCallbacks {
  onProgress?: StemsProgressCallback;
  onComplete?: StemsCompleteCallback;
  onError?: StemsErrorCallback;
}

export class StemsService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isModelLoaded = false;
  private initPromise: Promise<void> | null = null;

  // Callbacks for model loading events
  private modelLoadingCallbacks = new Set<ModelLoadingCallback>();
  private modelReadyCallbacks = new Set<ModelReadyCallback>();

  // Per-track analysis callbacks
  private analysisCallbacks = new Map<number, AnalysisCallbacks>();

  constructor() {
    // Worker is initialized lazily on first use
  }

  /**
   * Initialize the stems worker.
   * Called automatically on first analysis request.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[Stems Service] Initializing worker...');

      this.worker = new Worker(
        new URL('../workers/stems.worker.ts', import.meta.url),
        { type: 'module', name: 'meta-dj-stems' }
      );

      // Set up message handler
      this.worker.onmessage = (event) => this.handleWorkerMessage(event);

      this.worker.onerror = (error) => {
        console.error('[Stems Service] Worker error:', error);
      };

      this.isInitialized = true;
      console.log('[Stems Service] Worker initialized');
    } catch (error) {
      console.error('[Stems Service] Failed to initialize worker:', error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Handle messages from the stems worker.
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case EventType.STEMS_ANALYZE_PROGRESS: {
        const progress = payload as StemAnalyzeProgress;
        const callbacks = this.analysisCallbacks.get(progress.trackId);
        if (callbacks?.onProgress) {
          callbacks.onProgress(progress);
        }
        break;
      }

      case EventType.STEMS_ANALYZE_COMPLETE: {
        const complete = payload as StemAnalyzeComplete;
        const callbacks = this.analysisCallbacks.get(complete.trackId);
        if (callbacks?.onComplete) {
          callbacks.onComplete(complete);
        }
        this.analysisCallbacks.delete(complete.trackId);
        break;
      }

      case EventType.STEMS_ANALYZE_ERROR: {
        const error = payload as StemAnalyzeError;
        const callbacks = this.analysisCallbacks.get(error.trackId);
        if (callbacks?.onError) {
          callbacks.onError(error);
        }
        this.analysisCallbacks.delete(error.trackId);
        break;
      }

      case EventType.STEMS_MODEL_LOADING: {
        const loading = payload as StemModelLoading;
        this.modelLoadingCallbacks.forEach((cb) => cb(loading));
        break;
      }

      case EventType.STEMS_MODEL_READY: {
        const ready = payload as StemModelReady;
        this.isModelLoaded = true;
        this.modelReadyCallbacks.forEach((cb) => cb(ready));
        break;
      }

      default:
        console.warn('[Stems Service] Unknown message type:', type);
    }
  }

  /**
   * Analyze stems for a track.
   *
   * @param trackId - Track ID for tracking the analysis
   * @param audioBuffer - The audio buffer to analyze
   * @param callbacks - Callbacks for progress, completion, and errors
   */
  async analyzeStems(
    trackId: number,
    audioBuffer: AudioBuffer,
    callbacks: AnalysisCallbacks
  ): Promise<void> {
    // Ensure worker is initialized
    await this.initialize();

    if (!this.worker) {
      throw new Error('Stems worker not initialized');
    }

    // Store callbacks for this track
    this.analysisCallbacks.set(trackId, callbacks);

    // Convert AudioBuffer to transferable ArrayBuffer
    // For stereo, interleave the channels
    const numChannels = audioBuffer.numberOfChannels;
    const numSamples = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    let audioData: ArrayBuffer;

    if (numChannels === 1) {
      // Mono - just copy the data
      audioData = audioBuffer.getChannelData(0).buffer.slice(0);
    } else {
      // Stereo or more - interleave first two channels
      const left = audioBuffer.getChannelData(0);
      const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
      const interleaved = new Float32Array(numSamples * 2);

      for (let i = 0; i < numSamples; i++) {
        interleaved[i * 2] = left[i];
        interleaved[i * 2 + 1] = right[i];
      }

      audioData = interleaved.buffer;
    }

    // Send analysis request to worker
    const request: StemAnalyzeRequest = {
      trackId,
      audioData,
      sampleRate,
      channels: Math.min(numChannels, 2), // We only send up to 2 channels
    };

    this.worker.postMessage(
      {
        type: EventType.STEMS_ANALYZE_REQUEST,
        payload: request,
        timestamp: Date.now(),
      },
      [audioData] // Transfer ownership
    );
  }

  /**
   * Cancel an ongoing stem analysis.
   */
  cancelAnalysis(trackId: number): void {
    if (!this.worker) return;

    this.worker.postMessage({
      type: EventType.STEMS_ANALYZE_CANCEL,
      payload: { trackId },
      timestamp: Date.now(),
    });

    // Remove callbacks immediately
    this.analysisCallbacks.delete(trackId);
  }

  /**
   * Subscribe to model loading progress.
   */
  onModelLoading(callback: ModelLoadingCallback): () => void {
    this.modelLoadingCallbacks.add(callback);
    return () => this.modelLoadingCallbacks.delete(callback);
  }

  /**
   * Subscribe to model ready events.
   */
  onModelReady(callback: ModelReadyCallback): () => void {
    this.modelReadyCallbacks.add(callback);
    return () => this.modelReadyCallbacks.delete(callback);
  }

  /**
   * Terminate the worker and clean up resources.
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.isModelLoaded = false;
    this.initPromise = null;
    this.analysisCallbacks.clear();
    this.modelLoadingCallbacks.clear();
    this.modelReadyCallbacks.clear();
  }

  /**
   * Convert stem ArrayBuffers to AudioBuffers.
   * Helper function for use after receiving StemAnalyzeComplete.
   */
  static createStemBuffers(
    complete: StemAnalyzeComplete,
    audioContext: AudioContext
  ): StemBuffers {
    const { stems, sampleRate } = complete;

    const createBuffer = (data: ArrayBuffer): AudioBuffer | null => {
      if (data.byteLength === 0) return null;

      const float32 = new Float32Array(data);
      // Assume mono output from model for simplicity
      // Real implementation would depend on model output format
      const buffer = audioContext.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);
      return buffer;
    };

    return {
      vocals: createBuffer(stems.vocals),
      drums: createBuffer(stems.drums),
      bass: createBuffer(stems.bass),
      other: createBuffer(stems.other),
    };
  }
}

// Export singleton instance
export const stemsService = new StemsService();
