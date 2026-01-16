/**
 * Type declarations for music-tempo
 *
 * music-tempo is a JavaScript library for BPM detection and beat tracking
 * using the Beatroot algorithm.
 */

declare module 'music-tempo' {
  interface MusicTempoParams {
    /** FFT window size (default: 2048) */
    bufferSize?: number;
    /** Spacing of audio frames in samples (default: 441) */
    hopSize?: number;
    /** How quickly previous peaks are forgotten (default: 0.84) */
    decayRate?: number;
    /** Minimum distance between peaks (default: 6) */
    peakFindingWindow?: number;
    /** Multiplier for peak finding window (default: 3) */
    meanWndMultiplier?: number;
    /** Minimum value of peaks (default: 0.35) */
    peakThreshold?: number;
    /** Maximum difference in IOIs in same cluster (default: 0.025) */
    widthTreshold?: number;
    /** Maximum IOI for cluster inclusion (default: 2.5) */
    maxIOI?: number;
    /** Minimum IOI for cluster inclusion (default: 0.07) */
    minIOI?: number;
    /** Initial tempo hypotheses count (default: 10) */
    maxTempos?: number;
    /** Minimum inter-beat interval in seconds (default: 0.3 = 200 BPM max) */
    minBeatInterval?: number;
    /** Maximum inter-beat interval in seconds (default: 1 = 60 BPM min) */
    maxBeatInterval?: number;
    /** Duration of initial section (default: 5) */
    initPeriod?: number;
    /** JND of IBI for removing duplicate agents (default: 0.02) */
    thresholdBI?: number;
    /** JND of phase for removing duplicate agents (default: 0.04) */
    thresholdBT?: number;
    /** Time after which inactive agent is destroyed (default: 10) */
    expiryTime?: number;
    /** Max beat deviation without fork (default: 0.04) */
    toleranceWndInner?: number;
    /** Max early beat deviation fraction (default: 0.15) */
    toleranceWndPre?: number;
    /** Max late beat deviation fraction (default: 0.3) */
    toleranceWndPost?: number;
    /** Correction factor for beat period (default: 50) */
    correctionFactor?: number;
    /** Max deviation from initial tempo (default: 0.2) */
    maxChange?: number;
    /** Factor for correcting score on imprecise onset (default: 0.5) */
    penaltyFactor?: number;
    /** Time step for onset detection (default: 0.01) */
    timeStep?: number;
  }

  class MusicTempo {
    /** The tempo value in beats per minute (as string with 3 decimal places) */
    tempo: string | number;
    /** Beat times array in seconds */
    beats: number[];
    /** Inter-beat interval in seconds */
    beatInterval: number;
    /** Spectral flux array */
    spectralFlux: number[];
    /** Spectral flux peaks indexes */
    peaks: number[];
    /** Onset times array */
    events: number[];
    /** Tempo hypotheses array */
    tempoList: number[];

    /**
     * Create a new MusicTempo analyzer
     * @param audioData - Float32Array of audio samples (-1.0 to 1.0)
     * @param params - Optional configuration parameters
     */
    constructor(audioData: Float32Array | number[], params?: MusicTempoParams);
  }

  export default MusicTempo;
}
