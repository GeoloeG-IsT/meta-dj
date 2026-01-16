/// <reference lib="webworker" />

/**
 * Stems Worker
 *
 * Handles stem separation using ONNX Runtime Web with WebGPU backend.
 * Runs entirely in a dedicated worker to prevent blocking main thread.
 *
 * Architecture Notes:
 * - WebGPU backend is required (no WASM fallback per architecture decision)
 * - Model is loaded lazily on first analysis request
 * - Progress is reported via postMessage at each stage
 */

import * as ort from 'onnxruntime-web';
import { EventType } from '../../../shared/types/messaging';
import type {
  StemAnalyzeRequest,
  StemAnalyzeProgress,
  StemAnalyzeComplete,
  StemAnalyzeError,
  StemAnalyzeCancel,
  StemModelLoading,
  StemModelReady,
  StemAnalysisStage,
} from '../types/stems';

declare const self: DedicatedWorkerGlobalScope;

// ============================================================
// State
// ============================================================

let session: ort.InferenceSession | null = null;
let isModelLoading = false;
let currentAnalysis: { trackId: number; cancelled: boolean } | null = null;

const log = (...args: unknown[]) => console.log('[Stems Worker]', ...args);
const error = (...args: unknown[]) => console.error('[Stems Worker]', ...args);

// ============================================================
// Model Download with IndexedDB Caching
// ============================================================

const MODEL_CACHE_DB = 'meta-dj-stems-models';
const MODEL_CACHE_STORE = 'models';

/**
 * Download model with progress reporting and IndexedDB caching.
 */
async function downloadModelWithProgress(
  url: string,
  expectedSize: number,
  onProgress: (percentage: number) => void
): Promise<ArrayBuffer> {
  // Try to load from cache first
  const cached = await getModelFromCache(url);
  if (cached) {
    log('Model loaded from cache');
    onProgress(100);
    return cached;
  }

  log(`Downloading model from ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : expectedSize;

  if (!response.body) {
    // Fallback for environments without ReadableStream
    const data = await response.arrayBuffer();
    onProgress(100);
    await cacheModel(url, data);
    return data;
  }

  // Stream download with progress
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    const percentage = Math.round((loaded / total) * 100);
    onProgress(percentage);
  }

  // Combine chunks into single ArrayBuffer
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  // Cache for future use
  await cacheModel(url, data.buffer);
  log('Model cached for future use');

  return data.buffer;
}

/**
 * Get model from IndexedDB cache.
 */
async function getModelFromCache(url: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(MODEL_CACHE_DB, 1);

      request.onerror = () => resolve(null);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(MODEL_CACHE_STORE)) {
          db.createObjectStore(MODEL_CACHE_STORE, { keyPath: 'url' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(MODEL_CACHE_STORE, 'readonly');
          const store = tx.objectStore(MODEL_CACHE_STORE);
          const getRequest = store.get(url);

          getRequest.onsuccess = () => {
            const result = getRequest.result;
            resolve(result?.data ?? null);
          };

          getRequest.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Cache model in IndexedDB.
 */
async function cacheModel(url: string, data: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(MODEL_CACHE_DB, 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(MODEL_CACHE_STORE)) {
          db.createObjectStore(MODEL_CACHE_STORE, { keyPath: 'url' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(MODEL_CACHE_STORE, 'readwrite');
          const store = tx.objectStore(MODEL_CACHE_STORE);

          store.put({ url, data, cachedAt: Date.now() });

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      };
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================
// Progress Reporting
// ============================================================

function reportProgress(trackId: number, progress: number, stage: StemAnalysisStage) {
  const message: StemAnalyzeProgress = { trackId, progress, stage };
  self.postMessage({
    type: EventType.STEMS_ANALYZE_PROGRESS,
    payload: message,
    timestamp: Date.now(),
  });
}

function reportError(trackId: number, errorType: StemAnalyzeError['errorType'], errorMessage: string) {
  const message: StemAnalyzeError = {
    trackId,
    errorType,
    message: errorMessage,
  };
  self.postMessage({
    type: EventType.STEMS_ANALYZE_ERROR,
    payload: message,
    timestamp: Date.now(),
  });
}

function reportModelLoading(progress: number, message: string) {
  const payload: StemModelLoading = { progress, message };
  self.postMessage({
    type: EventType.STEMS_MODEL_LOADING,
    payload,
    timestamp: Date.now(),
  });
}

function reportModelReady(modelName: string, isWebGPU: boolean) {
  const payload: StemModelReady = { modelName, isWebGPU };
  self.postMessage({
    type: EventType.STEMS_MODEL_READY,
    payload,
    timestamp: Date.now(),
  });
}

// ============================================================
// ONNX Model Loading
// ============================================================

async function initializeONNX(): Promise<boolean> {
  if (session) return true;
  if (isModelLoading) return false;

  isModelLoading = true;
  log('Initializing ONNX Runtime with WebGPU...');
  reportModelLoading(0, 'Initializing ONNX Runtime...');

  try {
    // Configure ONNX Runtime for WebGPU
    // Note: WebGPU backend requires specific configuration
    ort.env.wasm.numThreads = 1; // Single thread for worker
    ort.env.wasm.simd = true;

    reportModelLoading(20, 'Checking WebGPU availability...');

    // Check if WebGPU is available in this worker context
    // TypeScript doesn't have WebGPU types for workers, so we check and cast
    if (!('gpu' in navigator) || !navigator.gpu) {
      throw new Error('WebGPU not available in worker context');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }

    log('WebGPU adapter found:', adapter);
    reportModelLoading(40, 'Downloading stem separation model...');

    // Model configuration - hosted on HuggingFace
    const MODEL_URL = 'https://huggingface.co/arjune123/demucs-onnx/resolve/main/htdemucs_6s.onnx';
    const MODEL_NAME = 'htdemucs_6s';
    const MODEL_SIZE = 114_559_139; // ~114MB

    // Download model with progress reporting
    let modelData: ArrayBuffer;
    try {
      modelData = await downloadModelWithProgress(MODEL_URL, MODEL_SIZE, (progress) => {
        // Map download progress to 40-80% of total loading progress
        const loadProgress = 40 + Math.round(progress * 0.4);
        reportModelLoading(loadProgress, `Downloading model... ${progress}%`);
      });
      log(`Model downloaded: ${modelData.byteLength} bytes`);
    } catch (downloadError) {
      error('Failed to download model:', downloadError);
      isModelLoading = false;
      throw new Error(`Failed to download stem separation model: ${downloadError}`);
    }

    reportModelLoading(85, 'Initializing inference session...');

    // Create inference session from ArrayBuffer with WebGPU backend
    try {
      session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
      });

      log('ONNX session created with WebGPU backend');
      reportModelLoading(100, 'Model loaded successfully');
      reportModelReady(MODEL_NAME, true);

      isModelLoading = false;
      return true;
    } catch (modelError) {
      error('Failed to create inference session:', modelError);
      isModelLoading = false;
      throw new Error(`Failed to initialize stem separation model: ${modelError}`);
    }
  } catch (err) {
    isModelLoading = false;
    error('ONNX initialization failed:', err);
    throw err;
  }
}

// ============================================================
// Stem Separation Logic
// ============================================================

// Chunk size in samples (10 seconds at 44.1kHz)
// Demucs typically processes in chunks to manage memory
const CHUNK_SIZE = 44100 * 10;
const CHUNK_OVERLAP = 44100; // 1 second overlap for smooth transitions

async function analyzeStems(request: StemAnalyzeRequest): Promise<void> {
  const { trackId, audioData, sampleRate, channels } = request;

  // Set current analysis for cancellation support
  currentAnalysis = { trackId, cancelled: false };

  try {
    // Stage 1: Load model if not already loaded
    reportProgress(trackId, 5, 'loading_model');

    if (!session) {
      try {
        await initializeONNX();
      } catch (initError) {
        reportError(trackId, 'MODEL_LOAD_FAILED',
          initError instanceof Error ? initError.message : 'Failed to load model');
        return;
      }
    }

    if (currentAnalysis?.cancelled) {
      reportError(trackId, 'CANCELLED', 'Analysis cancelled by user');
      return;
    }

    // Stage 2: Preprocess audio
    reportProgress(trackId, 15, 'preprocessing');

    const audioFloat32 = new Float32Array(audioData);
    const numSamples = audioFloat32.length / channels;

    log(`Processing ${numSamples} samples at ${sampleRate}Hz (${(numSamples / sampleRate).toFixed(1)}s)`);

    // Convert interleaved to planar stereo
    const stereoData = convertToStereo(audioFloat32, channels, numSamples);

    if (currentAnalysis?.cancelled) {
      reportError(trackId, 'CANCELLED', 'Analysis cancelled by user');
      return;
    }

    // Stage 3: Run chunked inference
    reportProgress(trackId, 20, 'inference');

    if (!session) {
      reportError(trackId, 'MODEL_LOAD_FAILED', 'Model session not available');
      return;
    }

    // Calculate chunks
    const adjustedChunkSize = Math.round(CHUNK_SIZE * (sampleRate / 44100));
    const adjustedOverlap = Math.round(CHUNK_OVERLAP * (sampleRate / 44100));
    const numChunks = Math.ceil(numSamples / (adjustedChunkSize - adjustedOverlap));

    log(`Processing ${numChunks} chunks (${adjustedChunkSize} samples each)`);

    // Initialize output buffers
    const outputStems = {
      vocals: new Float32Array(numSamples),
      drums: new Float32Array(numSamples),
      bass: new Float32Array(numSamples),
      other: new Float32Array(numSamples),
    };

    // Process each chunk
    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      if (currentAnalysis?.cancelled) {
        reportError(trackId, 'CANCELLED', 'Analysis cancelled by user');
        return;
      }

      const startSample = chunkIdx * (adjustedChunkSize - adjustedOverlap);
      const endSample = Math.min(startSample + adjustedChunkSize, numSamples);
      const chunkLength = endSample - startSample;

      // Extract chunk (2 channels)
      const chunkData = new Float32Array(chunkLength * 2);
      for (let i = 0; i < chunkLength; i++) {
        chunkData[i] = stereoData[startSample + i]; // Left
        chunkData[chunkLength + i] = stereoData[numSamples + startSample + i]; // Right
      }

      // Create input tensor [1, 2, chunkLength]
      const inputTensor = new ort.Tensor('float32', chunkData, [1, 2, chunkLength]);

      // Run model on chunk
      const feeds = { audio: inputTensor };
      const results = await session.run(feeds);

      // Extract chunk outputs and blend into output buffers
      blendChunkOutputs(
        results,
        outputStems,
        startSample,
        chunkLength,
        numSamples,
        chunkIdx === 0,
        chunkIdx === numChunks - 1,
        adjustedOverlap
      );

      // Report progress (20-80% range for inference)
      const chunkProgress = 20 + Math.round(60 * (chunkIdx + 1) / numChunks);
      reportProgress(trackId, chunkProgress, 'inference');
    }

    if (currentAnalysis?.cancelled) {
      reportError(trackId, 'CANCELLED', 'Analysis cancelled by user');
      return;
    }

    // Stage 4: Post-process outputs
    reportProgress(trackId, 85, 'postprocessing');

    // Convert Float32Arrays to transferable ArrayBuffers
    const stemOutputs = {
      vocals: outputStems.vocals.buffer.slice(0) as ArrayBuffer,
      drums: outputStems.drums.buffer.slice(0) as ArrayBuffer,
      bass: outputStems.bass.buffer.slice(0) as ArrayBuffer,
      other: outputStems.other.buffer.slice(0) as ArrayBuffer,
    };

    reportProgress(trackId, 100, 'postprocessing');

    // Send completion message with transferable buffers
    const completeMessage: StemAnalyzeComplete = {
      trackId,
      stems: stemOutputs,
      sampleRate,
    };

    self.postMessage(
      {
        type: EventType.STEMS_ANALYZE_COMPLETE,
        payload: completeMessage,
        timestamp: Date.now(),
      },
      // Transfer ownership of buffers to main thread
      [
        stemOutputs.vocals,
        stemOutputs.drums,
        stemOutputs.bass,
        stemOutputs.other,
      ]
    );

    log(`Stem separation complete for track ${trackId}`);
  } catch (err) {
    error('Stem analysis failed:', err);

    let errorType: StemAnalyzeError['errorType'] = 'INFERENCE_FAILED';
    if (err instanceof Error) {
      if (err.message.includes('memory') || err.message.includes('OOM')) {
        errorType = 'OUT_OF_MEMORY';
      }
    }

    reportError(
      trackId,
      errorType,
      err instanceof Error ? err.message : 'Unknown error during stem separation'
    );
  } finally {
    currentAnalysis = null;
  }
}

/**
 * Convert interleaved audio to planar stereo format.
 */
function convertToStereo(
  audioData: Float32Array,
  channels: number,
  numSamples: number
): Float32Array {
  // Output: [left channel samples][right channel samples]
  const stereoData = new Float32Array(numSamples * 2);

  if (channels === 1) {
    // Mono to stereo (duplicate)
    for (let i = 0; i < numSamples; i++) {
      stereoData[i] = audioData[i];
      stereoData[numSamples + i] = audioData[i];
    }
  } else if (channels === 2) {
    // Interleaved to planar
    for (let i = 0; i < numSamples; i++) {
      stereoData[i] = audioData[i * 2];
      stereoData[numSamples + i] = audioData[i * 2 + 1];
    }
  } else {
    // Multi-channel: take first two channels
    for (let i = 0; i < numSamples; i++) {
      stereoData[i] = audioData[i * channels];
      stereoData[numSamples + i] = audioData[i * channels + 1];
    }
  }

  return stereoData;
}

/**
 * Blend chunk outputs into the final output buffers with crossfade.
 */
function blendChunkOutputs(
  results: ort.InferenceSession.OnnxValueMapType,
  outputStems: Record<string, Float32Array>,
  startSample: number,
  chunkLength: number,
  _totalSamples: number,
  isFirstChunk: boolean,
  isLastChunk: boolean,
  overlapSize: number
): void {
  const stemNames = ['vocals', 'drums', 'bass', 'other'];

  for (const stemName of stemNames) {
    const tensor = results[stemName];
    if (!tensor || !(tensor.data instanceof Float32Array)) {
      // If stem not found, leave as zeros
      continue;
    }

    const stemData = tensor.data as Float32Array;
    const output = outputStems[stemName];

    // Apply crossfade blending in overlap regions
    for (let i = 0; i < chunkLength; i++) {
      const outIdx = startSample + i;
      if (outIdx >= output.length) break;

      // Determine blend factor for crossfade
      let blendFactor = 1.0;

      if (!isFirstChunk && i < overlapSize) {
        // Fade in at the beginning (except first chunk)
        blendFactor = i / overlapSize;
      }

      if (!isLastChunk && i >= chunkLength - overlapSize) {
        // Fade out at the end (except last chunk)
        const fadePos = i - (chunkLength - overlapSize);
        blendFactor = 1.0 - fadePos / overlapSize;
      }

      // Blend: add weighted sample to existing value
      if (!isFirstChunk && i < overlapSize) {
        // In overlap region, blend with previous chunk
        output[outIdx] = output[outIdx] * (1 - blendFactor) + stemData[i] * blendFactor;
      } else {
        output[outIdx] = stemData[i] * blendFactor;
      }
    }
  }
}


// ============================================================
// Message Handler
// ============================================================

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case EventType.STEMS_ANALYZE_REQUEST: {
      const request = payload as StemAnalyzeRequest;
      log(`Received analysis request for track ${request.trackId}`);
      await analyzeStems(request);
      break;
    }

    case EventType.STEMS_ANALYZE_CANCEL: {
      const cancel = payload as StemAnalyzeCancel;
      if (currentAnalysis && currentAnalysis.trackId === cancel.trackId) {
        log(`Cancelling analysis for track ${cancel.trackId}`);
        currentAnalysis.cancelled = true;
      }
      break;
    }

    default:
      log(`Unknown message type: ${type}`);
  }
};

log('Stems Worker initialized');
