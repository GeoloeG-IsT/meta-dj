/**
 * MasterLimiter Tests
 *
 * Unit tests for the master bus limiter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterLimiter, LIMITER_SETTINGS } from './master-limiter';

// Mock DynamicsCompressorNode
const createMockCompressor = () => ({
  threshold: { value: 0 },
  knee: { value: 0 },
  ratio: { value: 12 },
  attack: { value: 0.003 },
  release: { value: 0.25 },
  connect: vi.fn(),
  disconnect: vi.fn(),
});

// Mock GainNode
const createMockGainNode = () => ({
  gain: {
    value: 1,
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: { currentTime: 0 },
});

const createMockAudioContext = () => ({
  createDynamicsCompressor: vi.fn(() => createMockCompressor()),
  createGain: vi.fn(() => createMockGainNode()),
  currentTime: 0,
});

describe('MasterLimiter', () => {
  let mockContext: ReturnType<typeof createMockAudioContext>;
  let limiter: MasterLimiter;

  beforeEach(() => {
    mockContext = createMockAudioContext();
    limiter = new MasterLimiter(mockContext as unknown as AudioContext);
  });

  describe('initialization', () => {
    it('should create a dynamics compressor node', () => {
      expect(mockContext.createDynamicsCompressor).toHaveBeenCalledTimes(1);
    });

    it('should create a master gain node', () => {
      expect(mockContext.createGain).toHaveBeenCalledTimes(1);
    });

    it('should configure compressor with brick wall settings', () => {
      const compressor = mockContext.createDynamicsCompressor.mock.results[0].value;
      expect(compressor.threshold.value).toBe(LIMITER_SETTINGS.THRESHOLD);
      expect(compressor.knee.value).toBe(LIMITER_SETTINGS.KNEE);
      expect(compressor.ratio.value).toBe(LIMITER_SETTINGS.RATIO);
      expect(compressor.attack.value).toBe(LIMITER_SETTINGS.ATTACK);
      expect(compressor.release.value).toBe(LIMITER_SETTINGS.RELEASE);
    });

    it('should wire master gain to compressor', () => {
      const gainNode = mockContext.createGain.mock.results[0].value;
      const compressor = mockContext.createDynamicsCompressor.mock.results[0].value;
      expect(gainNode.connect).toHaveBeenCalledWith(compressor);
    });
  });

  describe('input/output', () => {
    it('should return master gain as input', () => {
      const gainNode = mockContext.createGain.mock.results[0].value;
      expect(limiter.input).toBe(gainNode);
    });

    it('should return compressor as output', () => {
      const compressor = mockContext.createDynamicsCompressor.mock.results[0].value;
      expect(limiter.output).toBe(compressor);
    });
  });

  describe('master gain control', () => {
    it('should set master gain value', () => {
      limiter.setMasterGain(0.8);
      expect(limiter.getMasterGain()).toBe(0.8);
    });

    it('should clamp gain to minimum 0.0', () => {
      limiter.setMasterGain(-0.5);
      expect(limiter.getMasterGain()).toBe(0);
    });

    it('should clamp gain to maximum 1.5', () => {
      limiter.setMasterGain(2.0);
      expect(limiter.getMasterGain()).toBe(1.5);
    });

    it('should use exponential ramp for smooth transitions', () => {
      limiter.setMasterGain(0.5);
      const gainNode = mockContext.createGain.mock.results[0].value;
      expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should disconnect gain and compressor nodes', () => {
      const gainNode = mockContext.createGain.mock.results[0].value;
      const compressor = mockContext.createDynamicsCompressor.mock.results[0].value;

      limiter.dispose();

      expect(gainNode.disconnect).toHaveBeenCalled();
      expect(compressor.disconnect).toHaveBeenCalled();
    });
  });
});
