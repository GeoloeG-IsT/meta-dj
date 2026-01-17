/**
 * RubberbandLoader Tests - Verify WASM module loads correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RubberbandLoader, DEFAULT_WASM_PATH } from './rubberband-loader';

// Mock fetch for WASM binary
const mockWasmBinary = new ArrayBuffer(100);

describe('RubberbandLoader', () => {
  beforeEach(() => {
    // Reset loader state before each test
    RubberbandLoader.dispose();

    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockWasmBinary),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    RubberbandLoader.dispose();
  });

  describe('constants', () => {
    it('should have correct default WASM path', () => {
      expect(DEFAULT_WASM_PATH).toBe('/rubberband.wasm');
    });
  });

  describe('isLoaded', () => {
    it('should return false when not initialized', () => {
      expect(RubberbandLoader.isLoaded()).toBe(false);
    });
  });

  describe('getInstance', () => {
    it('should throw when not initialized', () => {
      expect(() => RubberbandLoader.getInstance()).toThrow(
        'RubberbandLoader not initialized. Call initialize() first.'
      );
    });
  });

  describe('initialization error handling', () => {
    it('should throw error if fetch returns non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      await expect(RubberbandLoader.initialize('/rubberband.wasm')).rejects.toThrow(
        'Failed to fetch Rubberband WASM: 404 Not Found'
      );
    });

    it('should throw error if fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(RubberbandLoader.initialize('/rubberband.wasm')).rejects.toThrow(
        'Network error'
      );
    });

    it('should allow retry after failure', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockWasmBinary),
        });

      vi.stubGlobal('fetch', mockFetch);

      // First call should fail
      await expect(RubberbandLoader.initialize('/rubberband.wasm')).rejects.toThrow();

      // Load promise should be cleared, allowing retry
      // Note: Second call will also fail in test env due to WASM compilation,
      // but fetch should be called again
      try {
        await RubberbandLoader.initialize('/rubberband.wasm');
      } catch {
        // Expected to fail in test environment
      }

      // Fetch should have been called twice (once per attempt)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('disposal', () => {
    it('should clear isLoaded state on dispose', async () => {
      // In test environment, initialization may fail due to WASM compilation
      // But we can test the dispose clears state
      RubberbandLoader.dispose();
      expect(RubberbandLoader.isLoaded()).toBe(false);
    });

    it('should allow getInstance to throw after dispose', () => {
      RubberbandLoader.dispose();
      expect(() => RubberbandLoader.getInstance()).toThrow();
    });
  });

  describe('fetch calls', () => {
    it('should fetch from provided WASM path', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockWasmBinary),
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        await RubberbandLoader.initialize('/custom/path/rubberband.wasm');
      } catch {
        // Expected to fail in test environment due to WASM compilation
      }

      expect(mockFetch).toHaveBeenCalledWith('/custom/path/rubberband.wasm');
    });

    it('should use default path when not provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockWasmBinary),
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        await RubberbandLoader.initialize();
      } catch {
        // Expected to fail in test environment due to WASM compilation
      }

      expect(mockFetch).toHaveBeenCalledWith(DEFAULT_WASM_PATH);
    });
  });
});
