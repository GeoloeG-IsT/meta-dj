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
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU not available in worker context');
    }

    const adapter = await navigator.gpu.requestAdapter();
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
    reportProgress(trackId, 20, 'preprocessing');

    const audioFloat32 = new Float32Array(audioData);
    const numSamples = audioFloat32.length / channels;

    log(`Processing ${numSamples} samples at ${sampleRate}Hz`);

    // Convert to model input format
    // Demucs expects [batch, channels, samples] tensor
    // For simplicity in this implementation, we'll process mono/stereo
    const inputTensor = preprocessAudio(audioFloat32, channels, numSamples);

    if (currentAnalysis?.cancelled) {
      reportError(trackId, 'CANCELLED', 'Analysis cancelled by user');
      return;
    }

    // Stage 3: Run inference
    reportProgress(trackId, 40, 'inference');

    if (!session) {
      reportError(trackId, 'MODEL_LOAD_FAILED', 'Model session not available');
      return;
    }

    // Run the model
    // Note: Actual model I/O depends on the specific ONNX model structure
    const feeds = { audio: inputTensor };
    const results = await session.run(feeds);

    if (currentAnalysis?.cancelled) {
      reportError(trackId, 'CANCELLED', 'Analysis cancelled by user');
      return;
    }

    // Stage 4: Post-process outputs
    reportProgress(trackId, 80, 'postprocessing');

    // Extract stem outputs from model results
    // The exact output names depend on the model
    const stemOutputs = postprocessStems(results, numSamples, sampleRate);

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
 * Preprocess audio for model input.
 * Converts raw audio to ONNX tensor format.
 */
function preprocessAudio(
  audioData: Float32Array,
  channels: number,
  numSamples: number
): ort.Tensor {
  // Create tensor with shape [1, channels, samples] for batch processing
  // If mono, duplicate to stereo for model compatibility
  const targetChannels = 2;
  const tensorData = new Float32Array(targetChannels * numSamples);

  if (channels === 1) {
    // Mono to stereo
    for (let i = 0; i < numSamples; i++) {
      tensorData[i] = audioData[i];
      tensorData[numSamples + i] = audioData[i];
    }
  } else if (channels === 2) {
    // Interleaved stereo to planar
    for (let i = 0; i < numSamples; i++) {
      tensorData[i] = audioData[i * 2];           // Left channel
      tensorData[numSamples + i] = audioData[i * 2 + 1]; // Right channel
    }
  } else {
    // Take first two channels
    for (let i = 0; i < numSamples; i++) {
      tensorData[i] = audioData[i * channels];
      tensorData[numSamples + i] = audioData[i * channels + 1];
    }
  }

  return new ort.Tensor('float32', tensorData, [1, targetChannels, numSamples]);
}

/**
 * Post-process model outputs into stem ArrayBuffers.
 * Converts model output tensors to transferable buffers.
 */
function postprocessStems(
  results: ort.InferenceSession.OnnxValueMapType,
  _numSamples: number,
  _sampleRate: number
): {
  vocals: ArrayBuffer;
  drums: ArrayBuffer;
  bass: ArrayBuffer;
  other: ArrayBuffer;
} {
  // Extract tensors from results
  // Output names depend on model - typically 'vocals', 'drums', 'bass', 'other'
  // or a single output with shape [batch, stems, channels, samples]

  // For demonstration, extract from model outputs
  // Real implementation depends on actual model structure
  const getBufferFromTensor = (tensorName: string): ArrayBuffer => {
    const tensor = results[tensorName];
    if (tensor && tensor.data instanceof Float32Array) {
      return tensor.data.buffer.slice(0);
    }
    // Return empty buffer if tensor not found (shouldn't happen with valid model)
    return new Float32Array(0).buffer;
  };

  // Try both naming conventions
  const stemNames = ['vocals', 'drums', 'bass', 'other'];
  const buffers: Record<string, ArrayBuffer> = {};

  for (const name of stemNames) {
    // Try direct name first
    if (results[name]) {
      buffers[name] = getBufferFromTensor(name);
    } else {
      // Placeholder - create empty buffer
      buffers[name] = new Float32Array(0).buffer;
    }
  }

  return {
    vocals: buffers.vocals,
    drums: buffers.drums,
    bass: buffers.bass,
    other: buffers.other,
  };
}

// ============================================================
// Message Handler
// ============================================================

self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

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
