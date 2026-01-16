/**
 * WebGPU Detector Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isWebGPUSupported, getWebGPUStatus, initWebGPUDetection } from './webgpu-detector';

describe('webgpu-detector', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
  });

  describe('isWebGPUSupported', () => {
    it('returns true when navigator.gpu exists', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn(),
          },
        },
        writable: true,
      });

      expect(isWebGPUSupported()).toBe(true);
    });

    it('returns false when navigator.gpu is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      expect(isWebGPUSupported()).toBe(false);
    });

    it('returns false when navigator is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      });

      expect(isWebGPUSupported()).toBe(false);
    });
  });

  describe('getWebGPUStatus', () => {
    it('returns unavailable status when WebGPU not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      const status = await getWebGPUStatus();

      expect(status.available).toBe(false);
      expect(status.adapterInfo).toBeNull();
      expect(status.unavailableReason).toContain('WebGPU is not supported');
    });

    it('returns unavailable status when no adapter found', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue(null),
          },
        },
        writable: true,
      });

      const status = await getWebGPUStatus();

      expect(status.available).toBe(false);
      expect(status.adapterInfo).toBeNull();
      expect(status.unavailableReason).toContain('No compatible GPU adapter found');
    });

    it('returns available status with adapter info when WebGPU works', async () => {
      const mockAdapterInfo = {
        vendor: 'TestVendor',
        architecture: 'TestArch',
        device: 'TestDevice',
        description: 'Test GPU',
      };

      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue({
              requestAdapterInfo: vi.fn().mockResolvedValue(mockAdapterInfo),
            }),
          },
        },
        writable: true,
      });

      const status = await getWebGPUStatus();

      expect(status.available).toBe(true);
      expect(status.adapterInfo).toEqual(mockAdapterInfo);
      expect(status.unavailableReason).toBeNull();
    });

    it('handles errors during adapter request', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockRejectedValue(new Error('GPU access denied')),
          },
        },
        writable: true,
      });

      const status = await getWebGPUStatus();

      expect(status.available).toBe(false);
      expect(status.adapterInfo).toBeNull();
      expect(status.unavailableReason).toContain('GPU access denied');
    });
  });

  describe('initWebGPUDetection', () => {
    it('logs success message when WebGPU available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockAdapterInfo = {
        vendor: 'NVIDIA',
        architecture: 'Ampere',
        device: 'RTX 3080',
        description: 'NVIDIA GeForce RTX 3080',
      };

      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue({
              requestAdapterInfo: vi.fn().mockResolvedValue(mockAdapterInfo),
            }),
          },
        },
        writable: true,
      });

      const status = await initWebGPUDetection();

      expect(status.available).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebGPU] Available')
      );

      consoleSpy.mockRestore();
    });

    it('logs warning message when WebGPU unavailable', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      const status = await initWebGPUDetection();

      expect(status.available).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebGPU] Unavailable')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
