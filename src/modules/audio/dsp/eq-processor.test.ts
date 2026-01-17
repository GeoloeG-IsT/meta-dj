/**
 * EQProcessor Tests
 *
 * Unit tests for the 3-band parametric EQ processor.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EQProcessor } from './eq-processor';

// Mock AudioContext and BiquadFilterNode
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
});

describe('EQProcessor', () => {
  let mockContext: ReturnType<typeof createMockAudioContext>;
  let eq: EQProcessor;

  beforeEach(() => {
    mockContext = createMockAudioContext();
    eq = new EQProcessor(mockContext as unknown as AudioContext);
  });

  describe('initialization', () => {
    it('should create three BiquadFilter nodes', () => {
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(3);
    });

    it('should configure low shelf filter at 320Hz', () => {
      // Access the internal low filter via input getter
      const input = eq.input as unknown as ReturnType<typeof createMockBiquadFilter>;
      expect(input.type).toBe('lowshelf');
      expect(input.frequency.value).toBe(320);
    });

    it('should configure mid peaking filter at 1000Hz with Q=0.7', () => {
      // Mid filter is the second one created
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      expect(midFilter.type).toBe('peaking');
      expect(midFilter.frequency.value).toBe(1000);
      expect(midFilter.Q.value).toBe(0.7);
    });

    it('should configure high shelf filter at 3200Hz', () => {
      // High filter is the third one created (and is the output)
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      expect(highFilter.type).toBe('highshelf');
      expect(highFilter.frequency.value).toBe(3200);
    });

    it('should chain filters: low -> mid -> high', () => {
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;

      expect(lowFilter.connect).toHaveBeenCalledWith(midFilter);
      expect(midFilter.connect).toHaveBeenCalled();
    });
  });

  describe('input/output', () => {
    it('should return low filter as input', () => {
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      expect(eq.input).toBe(lowFilter);
    });

    it('should return high filter as output', () => {
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      expect(eq.output).toBe(highFilter);
    });
  });

  describe('setLow', () => {
    it('should set low gain value', () => {
      eq.setLow(-6);
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      expect(lowFilter.gain.value).toBe(-6);
    });

    it('should clamp low gain to minimum -24dB', () => {
      eq.setLow(-30);
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      expect(lowFilter.gain.value).toBe(-24);
    });

    it('should clamp low gain to maximum +6dB', () => {
      eq.setLow(10);
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      expect(lowFilter.gain.value).toBe(6);
    });
  });

  describe('setMid', () => {
    it('should set mid gain value', () => {
      eq.setMid(3);
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      expect(midFilter.gain.value).toBe(3);
    });

    it('should clamp mid gain to minimum -24dB', () => {
      eq.setMid(-50);
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      expect(midFilter.gain.value).toBe(-24);
    });

    it('should clamp mid gain to maximum +6dB', () => {
      eq.setMid(20);
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      expect(midFilter.gain.value).toBe(6);
    });
  });

  describe('setHigh', () => {
    it('should set high gain value', () => {
      eq.setHigh(-12);
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      expect(highFilter.gain.value).toBe(-12);
    });

    it('should clamp high gain to minimum -24dB', () => {
      eq.setHigh(-100);
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      expect(highFilter.gain.value).toBe(-24);
    });

    it('should clamp high gain to maximum +6dB', () => {
      eq.setHigh(15);
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;
      expect(highFilter.gain.value).toBe(6);
    });
  });

  describe('getters', () => {
    it('should return current low gain', () => {
      eq.setLow(-10);
      expect(eq.getLow()).toBe(-10);
    });

    it('should return current mid gain', () => {
      eq.setMid(2);
      expect(eq.getMid()).toBe(2);
    });

    it('should return current high gain', () => {
      eq.setHigh(-5);
      expect(eq.getHigh()).toBe(-5);
    });
  });

  describe('dispose', () => {
    it('should disconnect all filters', () => {
      const lowFilter = mockContext.createBiquadFilter.mock.results[0].value;
      const midFilter = mockContext.createBiquadFilter.mock.results[1].value;
      const highFilter = mockContext.createBiquadFilter.mock.results[2].value;

      eq.dispose();

      expect(lowFilter.disconnect).toHaveBeenCalled();
      expect(midFilter.disconnect).toHaveBeenCalled();
      expect(highFilter.disconnect).toHaveBeenCalled();
    });
  });
});
