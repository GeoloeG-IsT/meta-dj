/**
 * ChannelStrip Tests
 *
 * Unit tests for the per-deck channel strip (EQ + Gain).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelStrip } from './channel-strip';

// Mock AudioContext
const createMockGainNode = () => ({
  gain: {
    value: 1,
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: { currentTime: 0 },
});

const createMockBiquadFilter = () => ({
  type: 'lowshelf' as BiquadFilterType,
  frequency: { value: 0 },
  gain: { value: 0 },
  Q: { value: 1 },
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const createMockAudioContext = () => ({
  createBiquadFilter: vi.fn(() => createMockBiquadFilter()),
  createGain: vi.fn(() => createMockGainNode()),
  currentTime: 0,
});

describe('ChannelStrip', () => {
  let mockContext: ReturnType<typeof createMockAudioContext>;
  let channelStrip: ChannelStrip;

  beforeEach(() => {
    mockContext = createMockAudioContext();
    channelStrip = new ChannelStrip(mockContext as unknown as AudioContext);
  });

  describe('initialization', () => {
    it('should create EQ processor (3 biquad filters)', () => {
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(3);
    });

    it('should create gain node', () => {
      expect(mockContext.createGain).toHaveBeenCalledTimes(1);
    });

    it('should set default gain to 1.0', () => {
      const gainNode = mockContext.createGain.mock.results[0].value;
      expect(gainNode.gain.value).toBe(1);
    });
  });

  describe('input/output', () => {
    it('should return EQ input as channel strip input', () => {
      // EQ input is the low filter (first biquad created)
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      expect(channelStrip.input).toBe(lowFilter);
    });

    it('should return gain node as output', () => {
      const gainNode = mockContext.createGain.mock.results[0].value;
      expect(channelStrip.output).toBe(gainNode);
    });
  });

  describe('EQ methods', () => {
    it('should delegate setLow to EQ processor', () => {
      channelStrip.setLow(-12);
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      expect(lowFilter.gain.value).toBe(-12);
    });

    it('should delegate setMid to EQ processor', () => {
      channelStrip.setMid(3);
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      expect(midFilter.gain.value).toBe(3);
    });

    it('should delegate setHigh to EQ processor', () => {
      channelStrip.setHigh(-6);
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      expect(highFilter.gain.value).toBe(-6);
    });

    it('should return EQ values via getters', () => {
      channelStrip.setLow(-5);
      channelStrip.setMid(2);
      channelStrip.setHigh(-3);

      expect(channelStrip.getLow()).toBe(-5);
      expect(channelStrip.getMid()).toBe(2);
      expect(channelStrip.getHigh()).toBe(-3);
    });
  });

  describe('gain control', () => {
    it('should set gain value', () => {
      channelStrip.setGain(0.8);
      expect(channelStrip.getGain()).toBe(0.8);
    });

    it('should clamp gain to minimum 0.0', () => {
      channelStrip.setGain(-0.5);
      expect(channelStrip.getGain()).toBe(0);
    });

    it('should clamp gain to maximum 1.5', () => {
      channelStrip.setGain(2.0);
      expect(channelStrip.getGain()).toBe(1.5);
    });

    it('should use exponential ramp for smooth transitions', () => {
      channelStrip.setGain(0.5);
      const gainNode = mockContext.createGain.mock.results[0].value;
      expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should disconnect EQ and gain nodes', () => {
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      const gainNode = mockContext.createGain.mock.results[0].value;

      channelStrip.dispose();

      expect(lowFilter.disconnect).toHaveBeenCalled();
      expect(midFilter.disconnect).toHaveBeenCalled();
      expect(highFilter.disconnect).toHaveBeenCalled();
      expect(gainNode.disconnect).toHaveBeenCalled();
    });
  });
});
