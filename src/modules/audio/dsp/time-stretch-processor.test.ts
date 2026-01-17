/**
 * TimeStretchProcessor Tests
 *
 * Tests the core time-stretching processor that wraps Rubberband WASM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock RubberBandInterface
const mockRubberbandInstance = {
  malloc: vi.fn().mockReturnValue(1000),
  free: vi.fn(),
  memWrite: vi.fn(),
  memWritePtr: vi.fn(),
  memReadF32: vi.fn().mockReturnValue(new Float32Array(128)),
  rubberband_new: vi.fn().mockReturnValue(1),
  rubberband_delete: vi.fn(),
  rubberband_reset: vi.fn(),
  rubberband_set_time_ratio: vi.fn(),
  rubberband_set_pitch_scale: vi.fn(),
  rubberband_get_time_ratio: vi.fn().mockReturnValue(1.0),
  rubberband_get_pitch_scale: vi.fn().mockReturnValue(1.0),
  rubberband_get_start_delay: vi.fn().mockReturnValue(512),
  rubberband_get_latency: vi.fn().mockReturnValue(512),
  rubberband_set_max_process_size: vi.fn(),
  rubberband_process: vi.fn(),
  rubberband_available: vi.fn().mockReturnValue(128),
  rubberband_retrieve: vi.fn().mockReturnValue(128),
  rubberband_get_channel_count: vi.fn().mockReturnValue(2),
};

// Mock RubberbandLoader
vi.mock('./rubberband-loader', () => ({
  RubberbandLoader: {
    initialize: vi.fn().mockResolvedValue(mockRubberbandInstance),
    isLoaded: vi.fn().mockReturnValue(true),
    getInstance: vi.fn().mockReturnValue(mockRubberbandInstance),
    dispose: vi.fn(),
  },
  RubberBandOption: {
    RubberBandOptionProcessRealTime: 1,
    RubberBandOptionEngineFaster: 0,
    RubberBandOptionPitchHighConsistency: 67108864,
    RubberBandOptionChannelsTogether: 268435456,
  },
}));

describe('TimeStretchProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('construction', () => {
    it('should create processor with default parameters', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);

      await processor.initialize();

      expect(mockRubberbandInstance.rubberband_new).toHaveBeenCalled();
      expect(processor.getSampleRate()).toBe(44100);
      expect(processor.getChannels()).toBe(2);
    });

    it('should initialize Rubberband with real-time options', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);

      await processor.initialize();

      // Check that rubberband_new was called with correct parameters
      const call = mockRubberbandInstance.rubberband_new.mock.calls[0];
      expect(call[0]).toBe(44100); // sampleRate
      expect(call[1]).toBe(2); // channels
      expect(call[3]).toBe(1.0); // initialTimeRatio
      expect(call[4]).toBe(1.0); // initialPitchScale
    });

    it('should set max process size after initialization', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);

      await processor.initialize();

      expect(mockRubberbandInstance.rubberband_set_max_process_size).toHaveBeenCalled();
    });
  });

  describe('setTimeRatio', () => {
    it('should set time ratio within valid range', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setTimeRatio(1.5);

      expect(mockRubberbandInstance.rubberband_set_time_ratio).toHaveBeenCalledWith(1, 1.5);
    });

    it('should clamp time ratio to minimum 0.5', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setTimeRatio(0.2);

      expect(mockRubberbandInstance.rubberband_set_time_ratio).toHaveBeenCalledWith(1, 0.5);
    });

    it('should clamp time ratio to maximum 2.0', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setTimeRatio(3.0);

      expect(mockRubberbandInstance.rubberband_set_time_ratio).toHaveBeenCalledWith(1, 2.0);
    });
  });

  describe('setPitchScale', () => {
    it('should set pitch scale within valid range', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setPitchScale(1.2);

      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 1.2);
    });

    it('should clamp pitch scale to minimum 0.5', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setPitchScale(0.1);

      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 0.5);
    });

    it('should clamp pitch scale to maximum 2.0', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setPitchScale(2.5);

      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 2.0);
    });
  });

  describe('setSemitones', () => {
    it('should convert semitones to pitch scale (0 semitones = 1.0)', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setSemitones(0);

      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 1.0);
    });

    it('should convert +12 semitones to pitch scale 2.0 (one octave up)', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setSemitones(12);

      // 2^(12/12) = 2.0
      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 2.0);
    });

    it('should convert -12 semitones to pitch scale 0.5 (one octave down)', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setSemitones(-12);

      // 2^(-12/12) = 0.5
      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 0.5);
    });

    it('should clamp semitones to -12 to +12 range', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.setSemitones(24); // Beyond +12

      // Should be clamped to +12 semitones = 2.0
      expect(mockRubberbandInstance.rubberband_set_pitch_scale).toHaveBeenCalledWith(1, 2.0);
    });
  });

  describe('getters', () => {
    it('should return current time ratio', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      mockRubberbandInstance.rubberband_get_time_ratio.mockReturnValue(1.5);
      expect(processor.getTimeRatio()).toBe(1.5);
    });

    it('should return current pitch scale', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      mockRubberbandInstance.rubberband_get_pitch_scale.mockReturnValue(1.2);
      expect(processor.getPitchScale()).toBe(1.2);
    });

    it('should return start delay', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      expect(processor.getStartDelay()).toBe(512);
    });

    it('should return latency', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      expect(processor.getLatency()).toBe(512);
    });
  });

  describe('process', () => {
    it('should process audio buffers', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      const input = [new Float32Array(128), new Float32Array(128)];
      const output = [new Float32Array(256), new Float32Array(256)];

      const samplesReturned = processor.process(input, output);

      expect(mockRubberbandInstance.rubberband_process).toHaveBeenCalled();
      expect(samplesReturned).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 if not initialized', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      // Not initialized

      const input = [new Float32Array(128), new Float32Array(128)];
      const output = [new Float32Array(256), new Float32Array(256)];

      const samplesReturned = processor.process(input, output);

      expect(samplesReturned).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset Rubberband state', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.reset();

      expect(mockRubberbandInstance.rubberband_reset).toHaveBeenCalledWith(1);
    });
  });

  describe('dispose', () => {
    it('should delete Rubberband state and free memory', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.dispose();

      expect(mockRubberbandInstance.rubberband_delete).toHaveBeenCalledWith(1);
      expect(mockRubberbandInstance.free).toHaveBeenCalled();
    });

    it('should be safe to call multiple times', async () => {
      const { TimeStretchProcessor } = await import('./time-stretch-processor');
      const processor = new TimeStretchProcessor(44100, 2);
      await processor.initialize();

      processor.dispose();
      processor.dispose(); // Should not throw

      expect(mockRubberbandInstance.rubberband_delete).toHaveBeenCalledTimes(1);
    });
  });
});
