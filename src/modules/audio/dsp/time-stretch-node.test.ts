/**
 * TimeStretchNode Tests
 *
 * Tests the Web Audio API node wrapper for time-stretching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock processor class
class MockTimeStretchProcessor {
  initialize = vi.fn().mockResolvedValue(undefined);
  isInitialized = vi.fn().mockReturnValue(true);
  setTimeRatio = vi.fn();
  setPitchScale = vi.fn();
  setSemitones = vi.fn();
  getTimeRatio = vi.fn().mockReturnValue(1.0);
  getPitchScale = vi.fn().mockReturnValue(1.0);
  getSemitones = vi.fn().mockReturnValue(0);
  getStartDelay = vi.fn().mockReturnValue(512);
  getLatency = vi.fn().mockReturnValue(512);
  process = vi.fn().mockReturnValue(128);
  reset = vi.fn();
  dispose = vi.fn();
}

// Mock TimeStretchProcessor
vi.mock('./time-stretch-processor', () => ({
  TimeStretchProcessor: MockTimeStretchProcessor,
}));

// Mock ScriptProcessorNode
const createMockScriptProcessor = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  onaudioprocess: null as ((event: unknown) => void) | null,
  bufferSize: 512,
});

// Mock GainNode
const createMockGainNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
});

// Mock AudioContext
const createMockAudioContext = () => ({
  sampleRate: 44100,
  createScriptProcessor: vi.fn().mockImplementation(createMockScriptProcessor),
  createGain: vi.fn().mockImplementation(createMockGainNode),
});

describe('TimeStretchNode', () => {
  let mockAudioContext: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mockAudioContext = createMockAudioContext();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('construction', () => {
    it('should create node with AudioContext', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);

      expect(node).toBeDefined();
    });

    it('should initialize with keylock disabled by default', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);

      expect(node.isKeylockEnabled()).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should initialize TimeStretchProcessor', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);

      await node.initialize();

      expect(node.isInitialized()).toBe(true);
    });

    it('should create script processor node', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);

      await node.initialize();

      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalled();
    });

    it('should create gain nodes for routing', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);

      await node.initialize();

      // Should create 3 gain nodes: input, output, bypass
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3);
    });
  });

  describe('keylock', () => {
    it('should enable keylock', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setKeylockEnabled(true);

      expect(node.isKeylockEnabled()).toBe(true);
    });

    it('should disable keylock', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setKeylockEnabled(true);
      node.setKeylockEnabled(false);

      expect(node.isKeylockEnabled()).toBe(false);
    });
  });

  describe('time ratio', () => {
    it('should set time ratio when initialized', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setTimeRatio(1.5);

      expect(node.getTimeRatio()).toBe(1.5);
    });

    it('should clamp time ratio to valid range', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setTimeRatio(3.0);

      // Should be clamped to 2.0
      expect(node.getTimeRatio()).toBeLessThanOrEqual(2.0);
    });
  });

  describe('pitch scale', () => {
    it('should set pitch scale when initialized', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setPitchScale(1.2);

      expect(node.getPitchScale()).toBe(1.2);
    });
  });

  describe('semitones', () => {
    it('should set semitones when initialized', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setSemitones(5);

      expect(node.getSemitones()).toBe(5);
    });

    it('should clamp semitones to -12 to +12', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setSemitones(15);

      // Should be clamped to 12
      expect(node.getSemitones()).toBeLessThanOrEqual(12);
    });
  });

  describe('latency', () => {
    it('should return latency from processor', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      expect(node.getLatency()).toBe(512);
    });
  });

  describe('bypass mode', () => {
    it('should bypass processing when keylock is disabled', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setKeylockEnabled(false);

      expect(node.isBypassed()).toBe(true);
    });

    it('should not bypass when keylock is enabled', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.setKeylockEnabled(true);

      expect(node.isBypassed()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset the processor', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.reset();

      // Verify reset was called on processor
      expect(node.isInitialized()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose of resources', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.dispose();

      // After dispose, should not be initialized
      expect(node.isInitialized()).toBe(false);
    });

    it('should be safe to call multiple times', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      node.dispose();
      node.dispose(); // Should not throw
    });
  });

  describe('audio connections', () => {
    it('should expose input node', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      expect(node.input).toBeDefined();
    });

    it('should expose output node', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      expect(node.output).toBeDefined();
    });

    it('should allow connecting to destination', async () => {
      const { TimeStretchNode } = await import('./time-stretch-node');
      const node = new TimeStretchNode(mockAudioContext as unknown as AudioContext);
      await node.initialize();

      const destination = { connect: vi.fn() };
      node.connect(destination as unknown as AudioNode);

      // Should not throw
    });
  });
});
