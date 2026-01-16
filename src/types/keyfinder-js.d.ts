/**
 * Type declarations for keyfinder-js
 *
 * keyfinder-js is a JavaScript port of libKeyFinder for musical key detection.
 */

declare module 'keyfinder-js' {
  /** Musical key enumeration */
  export enum key_t {
    A_MAJOR = 0,
    A_MINOR = 1,
    B_FLAT_MAJOR = 2,
    B_FLAT_MINOR = 3,
    B_MAJOR = 4,
    B_MINOR = 5,
    C_MAJOR = 6,
    C_MINOR = 7,
    D_FLAT_MAJOR = 8,
    D_FLAT_MINOR = 9,
    D_MAJOR = 10,
    D_MINOR = 11,
    E_FLAT_MAJOR = 12,
    E_FLAT_MINOR = 13,
    E_MAJOR = 14,
    E_MINOR = 15,
    F_MAJOR = 16,
    F_MINOR = 17,
    G_FLAT_MAJOR = 18,
    G_FLAT_MINOR = 19,
    G_MAJOR = 20,
    G_MINOR = 21,
    A_FLAT_MAJOR = 22,
    A_FLAT_MINOR = 23,
    SILENCE = 24,
  }

  /** Scale type enumeration */
  export enum scale_t {
    SCALE_MAJOR = 0,
    SCALE_MINOR = 1,
  }

  /** Temporal window type enumeration */
  export enum temporal_window_t {
    WINDOW_BLACKMAN = 0,
    WINDOW_HAMMING = 1,
  }

  /** Audio data container for key analysis */
  export class AudioData {
    samples: number[];

    constructor();

    getChannels(): number;
    setChannels(inChannels: number): void;
    getFrameRate(): number;
    setFrameRate(inFrameRate: number): void;

    append(that: AudioData): void;
    prepend(that: AudioData): void;

    getSample(index: number): number;
    getSampleByFrame(frame: number, channel: number): number;
    setSample(index: number, value: number): void;
    setSampleByFrame(frame: number, channel: number, value: number): void;

    addToSampleCount(inSamples: number): void;
    addToFrameCount(inFrames: number): void;
    getSampleCount(): number;
    getFrameCount(): number;

    reduceToMono(): void;
    downsample(factor: number, shortcut?: boolean): void;
    discardFramesFromFront(discardFrameCount: number): void;
    sliceSamplesFromBack(sliceSampleCount: number): AudioData;

    resetIterators(): void;
    readIteratorWithinUpperBound(): boolean;
    writeIteratorWithinUpperBound(): boolean;
    advanceReadIterator(by?: number): void;
    advanceWriteIterator(by?: number): void;
    getSampleAtReadIterator(): number;
    setSampleAtWriteIterator(value: number): void;
  }

  /** Workspace for progressive chromagram analysis */
  export class Workspace {
    remainderBuffer: AudioData;
    preprocessedBuffer: AudioData;
    chromagram: Chromagram | null;
    fftAdapter: unknown | null;
    lpfBuffer: number[] | null;

    constructor();
  }

  /** Chromagram data container */
  export class Chromagram {
    constructor(hops: number);

    getMagnitude(hop: number, band: number): number;
    setMagnitude(hop: number, band: number, value: number): void;
    collapseToOneHop(): number[];
    append(that: Chromagram): void;
    getHops(): number;
  }

  /** Main key finder class */
  export class KeyFinder {
    constructor();

    /**
     * Analyze audio and return detected key
     * @param originalAudio - Audio data to analyze
     * @returns Detected key as key_t enum value
     */
    keyOfAudio(originalAudio: AudioData): key_t;

    /**
     * Progressive chromagram analysis
     */
    progressiveChromagram(audio: AudioData, workspace: Workspace): void;

    /**
     * Finalize chromagram analysis
     */
    finalChromagram(workspace: Workspace): void;

    /**
     * Get key from chroma vector
     */
    keyOfChromaVector(chromaVector: number[]): key_t;

    /**
     * Get key from chroma vector with custom profiles
     */
    keyOfChromaVectorProfile(
      chromaVector: number[],
      overrideMajorProfile: number[],
      overrideMinorProfile: number[]
    ): key_t;

    /**
     * Get key from workspace chromagram
     */
    keyOfChromagram(workspace: Workspace): key_t;
  }

  /** Constants used in key detection */
  export class Constants {
    static PI: number;
    static SEMITONES: number;
    static OCTAVES: number;
    static BANDS: number;
    static KEYS: number;
    static TONEPROFILESIZE: number;
    static FFTFRAMESIZE: number;
    static HOPSIZE: number;
    static DIRECTSKSTRETCH: number;
    static MAJOR_PROFILE: number[];
    static MINOR_PROFILE: number[];
    static OCTAVE_WEIGHTS: number[];

    static getFrequencyOfBand(band: number): number;
    static getLastFrequency(): number;
    static toneProfileMajor(): number[];
    static toneProfileMinor(): number[];
  }
}
