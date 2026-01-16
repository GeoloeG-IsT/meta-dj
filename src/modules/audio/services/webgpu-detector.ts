/**
 * WebGPU Detection Service
 *
 * Detects WebGPU availability for stem separation feature.
 * Per architecture decision: NO fallback to WASM/CPU - stems feature
 * is completely disabled if WebGPU is unavailable.
 */

export interface WebGPUStatus {
  /** Whether WebGPU is available in this browser */
  available: boolean;
  /** GPU adapter info if available */
  adapterInfo: GPUAdapterInfo | null;
  /** Human-readable reason if unavailable */
  unavailableReason: string | null;
}

/**
 * Check if WebGPU is available in the current browser.
 * This is a synchronous check for the navigator.gpu object.
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu !== undefined;
}

/**
 * Get detailed WebGPU status including adapter information.
 * This performs an async check to request the GPU adapter.
 */
export async function getWebGPUStatus(): Promise<WebGPUStatus> {
  // Check if navigator.gpu exists
  if (!isWebGPUSupported()) {
    return {
      available: false,
      adapterInfo: null,
      unavailableReason: 'WebGPU is not supported in this browser. Stems feature requires Chrome 113+ or Edge 113+.',
    };
  }

  try {
    // Request GPU adapter
    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
      return {
        available: false,
        adapterInfo: null,
        unavailableReason: 'No compatible GPU adapter found. Your GPU may not support WebGPU.',
      };
    }

    // Get adapter info
    const info = await adapter.requestAdapterInfo();

    return {
      available: true,
      adapterInfo: info,
      unavailableReason: null,
    };
  } catch (error) {
    return {
      available: false,
      adapterInfo: null,
      unavailableReason: `WebGPU initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Initialize WebGPU detection and return status.
 * Call this once at app startup to determine if stems feature should be enabled.
 */
export async function initWebGPUDetection(): Promise<WebGPUStatus> {
  const status = await getWebGPUStatus();

  if (status.available && status.adapterInfo) {
    console.log(
      `[WebGPU] Available - Vendor: ${status.adapterInfo.vendor}, Architecture: ${status.adapterInfo.architecture}`
    );
  } else {
    console.warn(`[WebGPU] Unavailable - ${status.unavailableReason}`);
  }

  return status;
}
