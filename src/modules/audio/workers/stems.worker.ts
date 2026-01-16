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
    // TypeScript doesn't have WebGPU types for workers, so we use type assertion
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
    if (!gpu) {
      throw new Error('WebGPU not available in worker context');
    }

    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }

    log('WebGPU adapter found:', adapter);
    reportModelLoading(40, 'Loading stem separation model...');

    // Model path - will be loaded from public directory or CDN
    // For now, we'll use a placeholder path that will be configured later
    const modelPath = '/models/demucs-lite.onnx';

    // Create inference session with WebGPU backend
    // Note: The actual model loading will fail until we have a real model file
    try {
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
      });

      log('ONNX session created with WebGPU backend');
      reportModelLoading(100, 'Model loaded successfully');
      reportModelReady('demucs-lite', true);

      isModelLoading = false;
      return true;
    } catch (modelError) {
      // Model file doesn't exist yet - this is expected during development
      // We'll handle this gracefully and report the error
      error('Failed to load model:', modelError);

      // For development: create a mock session indicator
      // In production, this would fail and report error to user
      log('Model file not found - stem separation requires model deployment');

      isModelLoading = false;
      throw new Error('Stem separation model not deployed. Please check /models/demucs-lite.onnx');
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
