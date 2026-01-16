/**
 * Waveform Analyzer - 3-Band FFT computation for audio visualization
 *
 * This module computes frequency-separated peak data for waveform rendering.
 * Designed to run in a Worker context (no DOM dependencies).
 *
 * Architecture: Part of the "Split-Brain" pattern - heavy analysis runs in workers,
 * UI components only receive the pre-computed WaveformData.
 */

// Frequency band definitions (Hz)
export const FREQUENCY_BANDS = {
  LOW: { min: 20, max: 250 },    // Bass frequencies
  MID: { min: 250, max: 4000 },  // Mid frequencies
  HIGH: { min: 4000, max: 20000 }, // High frequencies (Nyquist-capped)
} as const;

export interface WaveformData {
  /** Normalized peak values for low frequencies (0-1) */
  low: Float32Array;
  /** Normalized peak values for mid frequencies (0-1) */
  mid: Float32Array;
  /** Normalized peak values for high frequencies (0-1) */
  high: Float32Array;
  /** Sample rate of the analyzed audio */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
  /** Number of data points per second */
  pointsPerSecond: number;
}

export interface WaveformOptions {
  /** Number of data points to generate per minute (~1000 default for overview) */
  pointsPerMinute?: number;
  /** FFT size for frequency analysis (power of 2, default 2048) */
  fftSize?: number;
}

export interface FrequencyBinIndices {
  lowStart: number;
  lowEnd: number;
  midStart: number;
  midEnd: number;
  highStart: number;
  highEnd: number;
}

const DEFAULT_POINTS_PER_MINUTE = 1000;
const DEFAULT_FFT_SIZE = 2048;

/**
 * WaveformAnalyzer performs 3-band FFT analysis on audio buffers.
 *
 * Usage:
 * ```typescript
 * const analyzer = new WaveformAnalyzer();
 * const waveformData = analyzer.analyzeBuffer(audioSamples, sampleRate);
 * const blob = analyzer.serializeWaveformData(waveformData);
 * ```
 */
export class WaveformAnalyzer {
  // Pre-allocated buffers for FFT computation (avoid GC in hot path)
  private fftReal: Float32Array | null = null;
  private fftImag: Float32Array | null = null;
  private windowFunction: Float32Array | null = null;
  private currentFftSize = 0;

  /**
   * Calculate which frequency bins correspond to each band.
   */
  getFrequencyBinIndices(sampleRate: number, fftSize: number): FrequencyBinIndices {
    const binWidth = sampleRate / fftSize;
    const nyquist = sampleRate / 2;

    return {
      lowStart: Math.floor(FREQUENCY_BANDS.LOW.min / binWidth),
      lowEnd: Math.floor(FREQUENCY_BANDS.LOW.max / binWidth),
      midStart: Math.floor(FREQUENCY_BANDS.MID.min / binWidth),
      midEnd: Math.floor(FREQUENCY_BANDS.MID.max / binWidth),
      highStart: Math.floor(FREQUENCY_BANDS.HIGH.min / binWidth),
      highEnd: Math.min(
        Math.floor(Math.min(FREQUENCY_BANDS.HIGH.max, nyquist) / binWidth),
        fftSize / 2
      ),
    };
  }

  /**
   * Analyze an audio buffer and extract 3-band frequency peaks.
   *
   * @param samples - Raw audio samples (mono Float32Array)
   * @param sampleRate - Sample rate in Hz (e.g., 44100)
   * @param options - Analysis options
   * @returns WaveformData with low/mid/high frequency peaks
   */
  analyzeBuffer(
    samples: Float32Array,
    sampleRate: number,
    options: WaveformOptions = {}
  ): WaveformData {
    const pointsPerMinute = options.pointsPerMinute ?? DEFAULT_POINTS_PER_MINUTE;
    const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;

    const duration = samples.length / sampleRate;
    const pointsPerSecond = pointsPerMinute / 60;
    const totalPoints = Math.ceil(duration * pointsPerSecond);

    // Allocate output arrays
    const low = new Float32Array(totalPoints);
    const mid = new Float32Array(totalPoints);
    const high = new Float32Array(totalPoints);

    // Ensure FFT buffers are allocated
    this.ensureBuffers(fftSize);

    // Get frequency bin indices for this sample rate
    const binIndices = this.getFrequencyBinIndices(sampleRate, fftSize);

    // Samples per analysis point
    const samplesPerPoint = samples.length / totalPoints;

    // Track max values for normalization
    let maxLow = 0;
    let maxMid = 0;
    let maxHigh = 0;

    // Process each point
    for (let i = 0; i < totalPoints; i++) {
      const startSample = Math.floor(i * samplesPerPoint);
      const endSample = Math.min(startSample + fftSize, samples.length);

      // Copy samples to FFT buffer with windowing
      this.prepareFFTBuffer(samples, startSample, endSample, fftSize);

      // Perform FFT
      this.performFFT(fftSize);

      // Extract band magnitudes
      const lowMag = this.getBandMagnitude(binIndices.lowStart, binIndices.lowEnd, fftSize);
      const midMag = this.getBandMagnitude(binIndices.midStart, binIndices.midEnd, fftSize);
      const highMag = this.getBandMagnitude(binIndices.highStart, binIndices.highEnd, fftSize);

      low[i] = lowMag;
      mid[i] = midMag;
      high[i] = highMag;

      // Track maximums for normalization
      maxLow = Math.max(maxLow, lowMag);
      maxMid = Math.max(maxMid, midMag);
      maxHigh = Math.max(maxHigh, highMag);
    }

    // Normalize to 0-1 range
    this.normalizeArray(low, maxLow);
    this.normalizeArray(mid, maxMid);
    this.normalizeArray(high, maxHigh);

    return {
      low,
      mid,
      high,
      sampleRate,
      duration,
      pointsPerSecond,
    };
  }

  /**
   * Serialize WaveformData to a compact binary format for database storage.
   */
  serializeWaveformData(data: WaveformData): Uint8Array {
    // Header: sampleRate (4), duration (4), pointsPerSecond (4), length (4) = 16 bytes
    // Data: low (length * 1), mid (length * 1), high (length * 1)
    // Using Uint8 for data to save space (0-255 maps to 0-1)

    const length = data.low.length;
    const headerSize = 16;
    const dataSize = length * 3; // 3 bands, 1 byte each
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // Write header
    view.setFloat32(0, data.sampleRate, true);
    view.setFloat32(4, data.duration, true);
    view.setFloat32(8, data.pointsPerSecond, true);
    view.setUint32(12, length, true);

    // Write data as Uint8 (0-255 representing 0-1)
    const byteArray = new Uint8Array(buffer, headerSize);
    for (let i = 0; i < length; i++) {
      byteArray[i] = Math.round(data.low[i] * 255);
      byteArray[length + i] = Math.round(data.mid[i] * 255);
      byteArray[length * 2 + i] = Math.round(data.high[i] * 255);
    }

    return new Uint8Array(buffer);
  }

  /**
   * Deserialize binary data back to WaveformData.
   */
  deserializeWaveformData(bytes: Uint8Array): WaveformData {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Read header
    const sampleRate = view.getFloat32(0, true);
    const duration = view.getFloat32(4, true);
    const pointsPerSecond = view.getFloat32(8, true);
    const length = view.getUint32(12, true);

    // Read data
    const headerSize = 16;
    const low = new Float32Array(length);
    const mid = new Float32Array(length);
    const high = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      low[i] = bytes[headerSize + i] / 255;
      mid[i] = bytes[headerSize + length + i] / 255;
      high[i] = bytes[headerSize + length * 2 + i] / 255;
    }

    return {
      low,
      mid,
      high,
      sampleRate,
      duration,
      pointsPerSecond,
    };
  }

  // ========== Private Methods ==========

  private ensureBuffers(fftSize: number): void {
    if (this.currentFftSize !== fftSize) {
      this.fftReal = new Float32Array(fftSize);
      this.fftImag = new Float32Array(fftSize);
      this.windowFunction = this.createHannWindow(fftSize);
      this.currentFftSize = fftSize;
    }
  }

  private createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  private prepareFFTBuffer(
    samples: Float32Array,
    start: number,
    end: number,
    fftSize: number
  ): void {
    const real = this.fftReal!;
    const window = this.windowFunction!;

    // Zero-fill buffer
    real.fill(0);

    // Copy samples with windowing
    const copyLength = Math.min(end - start, fftSize);
    for (let i = 0; i < copyLength; i++) {
      real[i] = samples[start + i] * window[i];
    }
  }

  /**
   * Simple DFT implementation (for testing/fallback).
   * In production, this would use a proper FFT library like KissFFT WASM.
   */
  private performFFT(size: number): void {
    const real = this.fftReal!;
    const imag = this.fftImag!;

    // Zero imaginary part
    imag.fill(0);

    // In-place Cooley-Tukey FFT
    this.fftInPlace(real, imag, size);
  }

  private fftInPlace(real: Float32Array, imag: Float32Array, n: number): void {
    // Bit reversal permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        // Swap real
        const tempR = real[i];
        real[i] = real[j];
        real[j] = tempR;
        // Swap imag
        const tempI = imag[i];
        imag[i] = imag[j];
        imag[j] = tempI;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey iterative FFT
    for (let step = 1; step < n; step <<= 1) {
      const halfStep = step;
      const tableStep = Math.PI / step;

      for (let group = 0; group < n; group += step << 1) {
        for (let pair = 0; pair < halfStep; pair++) {
          const angle = pair * tableStep;
          const cos = Math.cos(angle);
          const sin = -Math.sin(angle);

          const i1 = group + pair;
          const i2 = i1 + halfStep;

          const tr = cos * real[i2] - sin * imag[i2];
          const ti = sin * real[i2] + cos * imag[i2];

          real[i2] = real[i1] - tr;
          imag[i2] = imag[i1] - ti;
          real[i1] = real[i1] + tr;
          imag[i1] = imag[i1] + ti;
        }
      }
    }
  }

  private getBandMagnitude(startBin: number, endBin: number, fftSize: number): number {
    const real = this.fftReal!;
    const imag = this.fftImag!;

    let sum = 0;
    const binCount = endBin - startBin;

    if (binCount <= 0) return 0;

    for (let i = startBin; i < endBin && i < fftSize / 2; i++) {
      // Magnitude = sqrt(real^2 + imag^2)
      const magnitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      sum += magnitude;
    }

    // Return average magnitude for the band
    return sum / binCount;
  }

  private normalizeArray(arr: Float32Array, maxValue: number): void {
    if (maxValue === 0) return;

    for (let i = 0; i < arr.length; i++) {
      arr[i] = arr[i] / maxValue;
    }
  }
}

// Export singleton for convenience
export const waveformAnalyzer = new WaveformAnalyzer();
