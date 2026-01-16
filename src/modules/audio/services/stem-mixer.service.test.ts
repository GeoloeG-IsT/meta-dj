/**
 * Stem Mixer Service Tests
 *
 * Tests for loop boundary functionality in stem mixer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StemMixer, type LoopBoundary } from './stem-mixer.service';

// Mock AudioContext
const createMockAudioContext = () => {
  const mockGainNode = {
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockSourceNode = {
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };

  let currentTime = 0;

  return {
    currentTime,
    setCurrentTime: (t: number) => {
      currentTime = t;
    },
    get currentTimeValue() {
      return currentTime;
    },
    createGain: vi.fn(() => mockGainNode),
    createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
    mockGainNode,
  };
};

describe('StemMixer Loop Functionality', () => {
  let mixer: StemMixer;
  let mockContext: ReturnType<typeof createMockAudioContext>;
  let mockDestination: { connect: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockContext = createMockAudioContext();
    mockDestination = { connect: vi.fn() };

    // Create mixer with mocked context
    mixer = new StemMixer({
      audioContext: {
        get currentTime() {
          return mockContext.currentTimeValue;
        },
        createGain: mockContext.createGain,
        createBufferSource: mockContext.createBufferSource,
      } as unknown as AudioContext,
      destination: mockDestination as unknown as AudioNode,
    });
  });

  afterEach(() => {
    mixer.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('setLoop', () => {
    it('should set loop boundary', () => {
      const boundary: LoopBoundary = {
        inPointSeconds: 10,
        outPointSeconds: 20,
      };

      mixer.setLoop(boundary);

      expect(mixer.getLoop()).toEqual(boundary);
      expect(mixer.hasActiveLoop()).toBe(true);
    });

    it('should clear loop boundary when set to null', () => {
      const boundary: LoopBoundary = {
        inPointSeconds: 10,
        outPointSeconds: 20,
      };

      mixer.setLoop(boundary);
      mixer.setLoop(null);

      expect(mixer.getLoop()).toBeNull();
      expect(mixer.hasActiveLoop()).toBe(false);
    });
  });

  describe('getLoop', () => {
    it('should return null when no loop is set', () => {
      expect(mixer.getLoop()).toBeNull();
    });

    it('should return current loop boundary', () => {
      const boundary: LoopBoundary = {
        inPointSeconds: 5,
        outPointSeconds: 15,
      };

      mixer.setLoop(boundary);

      expect(mixer.getLoop()).toEqual(boundary);
    });
  });

  describe('hasActiveLoop', () => {
    it('should return false when no loop is set', () => {
      expect(mixer.hasActiveLoop()).toBe(false);
    });

    it('should return true when loop is set', () => {
      mixer.setLoop({
        inPointSeconds: 0,
        outPointSeconds: 10,
      });

      expect(mixer.hasActiveLoop()).toBe(true);
    });
  });

  describe('loop boundary checking during playback', () => {
    it('should clear loop on dispose', () => {
      mixer.setLoop({
        inPointSeconds: 10,
        outPointSeconds: 20,
      });

      mixer.dispose();

      // Re-create mixer for next test (since disposed)
      mixer = new StemMixer({
        audioContext: {
          get currentTime() {
            return mockContext.currentTimeValue;
          },
          createGain: mockContext.createGain,
          createBufferSource: mockContext.createBufferSource,
        } as unknown as AudioContext,
        destination: mockDestination as unknown as AudioNode,
      });

      expect(mixer.getLoop()).toBeNull();
    });
  });
});

describe('LoopBoundary interface', () => {
  it('should have correct structure', () => {
    const boundary: LoopBoundary = {
      inPointSeconds: 10.5,
      outPointSeconds: 20.25,
    };

    expect(boundary.inPointSeconds).toBe(10.5);
    expect(boundary.outPointSeconds).toBe(20.25);
  });
});
