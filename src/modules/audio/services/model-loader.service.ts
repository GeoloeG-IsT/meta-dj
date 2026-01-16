/**
 * Model Loader Service
 *
 * Handles downloading, caching, and loading ONNX models for stem separation.
 * Models are cached in IndexedDB for persistence across sessions.
 */

const DB_NAME = 'meta-dj-models';
const DB_VERSION = 1;
const STORE_NAME = 'models';

export interface ModelInfo {
  name: string;
  url: string;
  size: number; // Expected size in bytes
  version: string;
}

export interface ModelLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ModelLoadCallback = (progress: ModelLoadProgress) => void;

/**
 * Available stem separation models.
 * Note: URLs should be updated to point to actual model hosting.
 */
export const STEM_MODELS: Record<string, ModelInfo> = {
  // Lightweight model for development/testing
  'demucs-lite': {
    name: 'demucs-lite',
    url: '/models/demucs-lite.onnx',
    size: 20 * 1024 * 1024, // 20MB placeholder
    version: '1.0.0',
  },
  // Full quality model (htdemucs)
  'htdemucs': {
    name: 'htdemucs',
    url: '/models/htdemucs.onnx',
    size: 80 * 1024 * 1024, // ~80MB
    version: '1.0.0',
  },
} as const;

// Default model to use
export const DEFAULT_MODEL = 'demucs-lite';

class ModelLoaderService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database for model caching.
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[Model Loader] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Model Loader] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create models store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'name' });
          store.createIndex('version', 'version', { unique: false });
          console.log('[Model Loader] Created models store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Check if a model is cached locally.
   */
  async isModelCached(modelName: string): Promise<boolean> {
    await this.init();
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(modelName);

      request.onsuccess = () => {
        const cached = request.result;
        if (cached && cached.data) {
          // Check version matches
          const modelInfo = STEM_MODELS[modelName];
          if (modelInfo && cached.version === modelInfo.version) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * Get cached model data.
   */
  async getCachedModel(modelName: string): Promise<ArrayBuffer | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(modelName);

      request.onsuccess = () => {
        const cached = request.result;
        if (cached && cached.data) {
          resolve(cached.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Cache model data.
   */
  async cacheModel(modelName: string, data: ArrayBuffer, version: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        name: modelName,
        data,
        version,
        cachedAt: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        console.log(`[Model Loader] Cached model: ${modelName} (${data.byteLength} bytes)`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Download a model with progress reporting.
   */
  async downloadModel(
    modelName: string,
    onProgress?: ModelLoadCallback
  ): Promise<ArrayBuffer> {
    const modelInfo = STEM_MODELS[modelName];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    console.log(`[Model Loader] Downloading model: ${modelName} from ${modelInfo.url}`);

    const response = await fetch(modelInfo.url);

    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : modelInfo.size;

    if (!response.body) {
      // Fallback for browsers without ReadableStream support
      const data = await response.arrayBuffer();
      onProgress?.({ loaded: data.byteLength, total, percentage: 100 });
      return data;
    }

    // Stream the download with progress
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      onProgress?.({
        loaded,
        total,
        percentage: Math.round((loaded / total) * 100),
      });
    }

    // Combine chunks
    const data = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    return data.buffer;
  }

  /**
   * Load a model, using cache if available.
   */
  async loadModel(
    modelName: string = DEFAULT_MODEL,
    onProgress?: ModelLoadCallback
  ): Promise<ArrayBuffer> {
    const modelInfo = STEM_MODELS[modelName];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // Check cache first
    if (await this.isModelCached(modelName)) {
      console.log(`[Model Loader] Loading ${modelName} from cache`);
      onProgress?.({ loaded: 0, total: modelInfo.size, percentage: 0 });

      const cached = await this.getCachedModel(modelName);
      if (cached) {
        onProgress?.({ loaded: cached.byteLength, total: cached.byteLength, percentage: 100 });
        return cached;
      }
    }

    // Download and cache
    console.log(`[Model Loader] Model ${modelName} not cached, downloading...`);
    const data = await this.downloadModel(modelName, onProgress);

    // Cache for future use
    try {
      await this.cacheModel(modelName, data, modelInfo.version);
    } catch (cacheError) {
      console.warn('[Model Loader] Failed to cache model:', cacheError);
      // Continue even if caching fails
    }

    return data;
  }

  /**
   * Clear cached model.
   */
  async clearCache(modelName?: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = modelName
        ? store.delete(modelName)
        : store.clear();

      request.onsuccess = () => {
        console.log(`[Model Loader] Cleared cache${modelName ? ` for ${modelName}` : ''}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get cache status for all models.
   */
  async getCacheStatus(): Promise<Record<string, { cached: boolean; size?: number }>> {
    const status: Record<string, { cached: boolean; size?: number }> = {};

    for (const modelName of Object.keys(STEM_MODELS)) {
      const cached = await this.isModelCached(modelName);
      if (cached) {
        const data = await this.getCachedModel(modelName);
        status[modelName] = { cached: true, size: data?.byteLength };
      } else {
        status[modelName] = { cached: false };
      }
    }

    return status;
  }
}

export const modelLoaderService = new ModelLoaderService();
