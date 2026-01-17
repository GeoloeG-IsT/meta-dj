/**
 * PeakMeter Tests
 *
 * Unit tests for the peak/RMS metering system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PeakMeter,
  createMeterSAB,
  MeterReader,
  METER_SAB_LAYOUT,
} from './peak-meter';

// Mock AnalyserNode
const createMockAnalyser = () => {
  const dataArray = new Float32Array(256);
  // Fill with sample audio data (sine wave approximation)
  for (let i = 0; i < dataArray.length; i++) {
    dataArray[i] = Math.sin(i * 0.1) * 0.5; // Peak around 0.5
  }

  return {
    fftSize: 256,
    getFloatTimeDomainData: vi.fn((arr: Float32Array) => {
      arr.set(dataArray);
    }),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };
};

const createMockAudioContext = () => ({
  createAnalyser: vi.fn(() => createMockAnalyser()),
});

describe('PeakMeter', () => {
  let mockContext: ReturnType<typeof createMockAudioContext>;
  let sab: SharedArrayBuffer;
  let meter: PeakMeter;

  beforeEach(() => {
    mockContext = createMockAudioContext();
    sab = createMeterSAB();
    meter = new PeakMeter(mockContext as unknown as AudioContext, sab, 0);
  });

  describe('initialization', () => {
    it('should create an analyser node', () => {
      expect(mockContext.createAnalyser).toHaveBeenCalledTimes(1);
    });

    it('should configure analyser with small FFT size', () => {
      const analyser = mockContext.createAnalyser.mock.results[0].value;
      expect(analyser.fftSize).toBe(256);
    });
  });

  describe('input/output', () => {
    it('should return analyser as input', () => {
      const analyser = mockContext.createAnalyser.mock.results[0].value;
      expect(meter.input).toBe(analyser);
    });

    it('should return analyser as output (pass-through)', () => {
      const analyser = mockContext.createAnalyser.mock.results[0].value;
      expect(meter.output).toBe(analyser);
    });
  });

  describe('update', () => {
    it('should call getFloatTimeDomainData', () => {
      const analyser = mockContext.createAnalyser.mock.results[0].value;
      meter.update();
      expect(analyser.getFloatTimeDomainData).toHaveBeenCalled();
    });

    it('should write peak and RMS values to SAB', () => {
      meter.update();
      const view = new Float32Array(sab);
      // Peak and RMS should be non-zero after update
      expect(view[METER_SAB_LAYOUT.DECK_A_PEAK / 4]).toBeGreaterThan(0);
      expect(view[METER_SAB_LAYOUT.DECK_A_RMS / 4]).toBeGreaterThan(0);
    });
  });

  describe('dispose', () => {
    it('should disconnect analyser', () => {
      const analyser = mockContext.createAnalyser.mock.results[0].value;
      meter.dispose();
      expect(analyser.disconnect).toHaveBeenCalled();
    });
  });
});

describe('METER_SAB_LAYOUT', () => {
  it('should have correct total size', () => {
    expect(METER_SAB_LAYOUT.TOTAL_SIZE).toBe(40);
  });

  it('should have correct offsets for 5 channels', () => {
    expect(METER_SAB_LAYOUT.DECK_A_PEAK).toBe(0);
    expect(METER_SAB_LAYOUT.DECK_A_RMS).toBe(4);
    expect(METER_SAB_LAYOUT.DECK_B_PEAK).toBe(8);
    expect(METER_SAB_LAYOUT.DECK_B_RMS).toBe(12);
    expect(METER_SAB_LAYOUT.DECK_C_PEAK).toBe(16);
    expect(METER_SAB_LAYOUT.DECK_C_RMS).toBe(20);
    expect(METER_SAB_LAYOUT.DECK_D_PEAK).toBe(24);
    expect(METER_SAB_LAYOUT.DECK_D_RMS).toBe(28);
    expect(METER_SAB_LAYOUT.MASTER_PEAK).toBe(32);
    expect(METER_SAB_LAYOUT.MASTER_RMS).toBe(36);
  });
});

describe('createMeterSAB', () => {
  it('should create SharedArrayBuffer with correct size', () => {
    const sab = createMeterSAB();
    expect(sab.byteLength).toBe(METER_SAB_LAYOUT.TOTAL_SIZE);
  });
});

describe('MeterReader', () => {
  let sab: SharedArrayBuffer;
  let reader: MeterReader;

  beforeEach(() => {
    sab = createMeterSAB();
    reader = new MeterReader(sab);

    // Write some test values to SAB using layout constants
    const view = new Float32Array(sab);
    view[METER_SAB_LAYOUT.DECK_A_PEAK / 4] = 0.75; // Deck A peak
    view[METER_SAB_LAYOUT.DECK_A_RMS / 4] = 0.5;   // Deck A RMS
    view[METER_SAB_LAYOUT.MASTER_PEAK / 4] = 0.9;  // Master peak
    view[METER_SAB_LAYOUT.MASTER_RMS / 4] = 0.6;   // Master RMS
  });

  it('should read deck peak values', () => {
    expect(reader.getDeckPeak('A')).toBe(0.75);
  });

  it('should read deck RMS values', () => {
    expect(reader.getDeckRMS('A')).toBe(0.5);
  });

  it('should read master peak value', () => {
    expect(reader.getMasterPeak()).toBeCloseTo(0.9, 5);
  });

  it('should read master RMS value', () => {
    expect(reader.getMasterRMS()).toBeCloseTo(0.6, 5);
  });

  it('should return meter data object for deck', () => {
    const data = reader.getDeckMeter('A');
    expect(data.peak).toBeCloseTo(0.75, 5);
    expect(data.rms).toBeCloseTo(0.5, 5);
  });

  it('should return meter data object for master', () => {
    const data = reader.getMasterMeter();
    expect(data.peak).toBeCloseTo(0.9, 5);
    expect(data.rms).toBeCloseTo(0.6, 5);
  });
});
