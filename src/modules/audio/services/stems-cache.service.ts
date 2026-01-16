/**
 * Stems Cache Service
 *
 * Handles persistent storage of separated stems in IndexedDB.
 * Stems are cached to avoid re-analyzing tracks that have already been processed.
 */

import type { StemBuffers } from '../types/stems';

const DB_NAME = 'meta-dj-stems-cache';
const DB_VERSION = 1;
const STORE_NAME = 'stems';

export interface CachedStemEntry {
  /** Composite key: trackId-hash */
  key: string;
  /** Track ID */
  trackId: number;
  /** Hash of the original audio file (for invalidation) */
  audioHash: string;
  /** Sample rate of the stems */
  sampleRate: number;
  /** Number of samples per stem */
  numSamples: number;
  /** Timestamp when stems were cached */
  cachedAt: number;
  /** Stem audio data */
  stems: {
    vocals: ArrayBuffer;
    drums: ArrayBuffer;
    bass: ArrayBuffer;
    other: ArrayBuffer;
  };
}

export interface StemCacheStatus {
  /** Whether stems are cached for this track */
  cached: boolean;
  /** When stems were cached (if cached) */
  cachedAt?: number;
  /** Size of cached stems in bytes */
  totalSize?: number;
}

class StemsCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database for stem caching.
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[Stems Cache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Stems Cache] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stems store with composite key
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('trackId', 'trackId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          console.log('[Stems Cache] Created stems store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Generate a cache key for a track.
   */
  private getCacheKey(trackId: number, audioHash: string): string {
    return `${trackId}-${audioHash}`;
  }

  /**
   * Generate a simple hash for audio data.
   * Used for cache invalidation when track file changes.
   */
  async generateAudioHash(audioBuffer: AudioBuffer): Promise<string> {
    // Sample a subset of the audio for hashing (first 10 seconds or less)
    const samplesToHash = Math.min(audioBuffer.length, audioBuffer.sampleRate * 10);
    const channelData = audioBuffer.getChannelData(0);
    const sampleData = channelData.slice(0, samplesToHash);

    // Create a simple hash from sample values
    // Using SubtleCrypto for a proper hash
    const dataView = new DataView(sampleData.buffer, sampleData.byteOffset, sampleData.byteLength);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataView);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  /**
   * Check if stems are cached for a track.
   */
  async hasCachedStems(trackId: number, audioHash: string): Promise<boolean> {
    await this.init();
    if (!this.db) return false;

    const key = this.getCacheKey(trackId, audioHash);

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * Get cache status for a track.
   */
  async getCacheStatus(trackId: number): Promise<StemCacheStatus> {
    await this.init();
    if (!this.db) return { cached: false };

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackId');
      const request = index.getAll(trackId);

      request.onsuccess = () => {
        const entries = request.result as CachedStemEntry[];
        if (entries.length === 0) {
          resolve({ cached: false });
          return;
        }

        // Return most recent cache entry
        const latest = entries.sort((a, b) => b.cachedAt - a.cachedAt)[0];
        const totalSize =
          latest.stems.vocals.byteLength +
          latest.stems.drums.byteLength +
          latest.stems.bass.byteLength +
          latest.stems.other.byteLength;

        resolve({
          cached: true,
          cachedAt: latest.cachedAt,
          totalSize,
        });
      };

      request.onerror = () => {
        resolve({ cached: false });
      };
    });
  }

  /**
   * Store separated stems in cache.
   */
  async cacheStems(
    trackId: number,
    audioHash: string,
    stems: {
      vocals: ArrayBuffer;
      drums: ArrayBuffer;
      bass: ArrayBuffer;
      other: ArrayBuffer;
    },
    sampleRate: number,
    numSamples: number
  ): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not initialized');

    const key = this.getCacheKey(trackId, audioHash);

    // Clear any existing entries for this track (different hash = file changed)
    await this.clearTrackStems(trackId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const entry: CachedStemEntry = {
        key,
        trackId,
        audioHash,
        sampleRate,
        numSamples,
        cachedAt: Date.now(),
        stems,
      };

      const request = store.put(entry);

      request.onsuccess = () => {
        const totalSize =
          stems.vocals.byteLength +
          stems.drums.byteLength +
          stems.bass.byteLength +
          stems.other.byteLength;
        console.log(`[Stems Cache] Cached stems for track ${trackId} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Retrieve cached stems for a track.
   */
  async getCachedStems(
    trackId: number,
    audioHash: string
  ): Promise<{
    stems: { vocals: ArrayBuffer; drums: ArrayBuffer; bass: ArrayBuffer; other: ArrayBuffer };
    sampleRate: number;
    numSamples: number;
  } | null> {
    await this.init();
    if (!this.db) return null;

    const key = this.getCacheKey(trackId, audioHash);

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CachedStemEntry | undefined;
        if (entry) {
          resolve({
            stems: entry.stems,
            sampleRate: entry.sampleRate,
            numSamples: entry.numSamples,
          });
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
   * Clear cached stems for a specific track.
   */
  async clearTrackStems(trackId: number): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackId');

      // Get all entries for this track
      const getRequest = index.getAllKeys(trackId);

      getRequest.onsuccess = () => {
        const keys = getRequest.result;

        if (keys.length === 0) {
          resolve();
          return;
        }

        // Delete each entry
        let completed = 0;
        for (const key of keys) {
          const deleteRequest = store.delete(key);

          deleteRequest.onsuccess = () => {
            completed++;
            if (completed === keys.length) {
              console.log(`[Stems Cache] Cleared ${keys.length} cache entries for track ${trackId}`);
              resolve();
            }
          };

          deleteRequest.onerror = () => {
            reject(deleteRequest.error);
          };
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Clear all cached stems.
   */
  async clearAllStems(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[Stems Cache] Cleared all cached stems');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get total cache size.
   */
  async getTotalCacheSize(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CachedStemEntry[];
        let totalSize = 0;

        for (const entry of entries) {
          totalSize +=
            entry.stems.vocals.byteLength +
            entry.stems.drums.byteLength +
            entry.stems.bass.byteLength +
            entry.stems.other.byteLength;
        }

        resolve(totalSize);
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Get number of cached tracks.
   */
  async getCachedTrackCount(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Convert cached ArrayBuffers to AudioBuffers for playback.
   */
  static createAudioBuffers(
    cachedStems: {
      stems: { vocals: ArrayBuffer; drums: ArrayBuffer; bass: ArrayBuffer; other: ArrayBuffer };
      sampleRate: number;
      numSamples: number;
    },
    audioContext: AudioContext
  ): StemBuffers {
    const { stems, sampleRate } = cachedStems;

    const createBuffer = (data: ArrayBuffer): AudioBuffer | null => {
      if (data.byteLength === 0) return null;

      const float32 = new Float32Array(data);
      // Stems are stored as mono
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

export const stemsCacheService = new StemsCacheService();
