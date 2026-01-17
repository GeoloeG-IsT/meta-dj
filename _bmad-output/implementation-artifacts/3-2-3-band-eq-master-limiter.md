# Story 3.2: 3-Band EQ & Master Limiter

Status: ready-for-dev

## Story

As a user,
I want to adjust the High, Mid, and Low frequencies and control the overall volume of each deck,
So that I can blend tracks smoothly and prevent audio clipping.

## Acceptance Criteria

1. **Given** the AudioWorklet engine from Story 3.1
   **When** I adjust the EQ knobs in the UI
   **Then** the `AudioWorklet` must apply a 3-band filter chain (Low, Mid, High) with adjustable crossover frequencies

2. **Given** the audio graph with EQ filters
   **When** I adjust the channel gain
   **Then** it must include a `GainNode` for channel volume per deck

3. **Given** the mixing output from all decks
   **When** audio passes through the master output
   **Then** a master `DynamicsCompressorNode` must act as a limiter to prevent clipping

4. **Given** audio is playing through the deck
   **When** the UI needs visual feedback
   **Then** real-time peak metering data must be provided to the UI via `SharedArrayBuffer`

## Tasks / Subtasks

- [x] Task 1: Create EQ Processor Node (AC: #1)
  - [x] 1.1: Create `src/modules/audio/dsp/eq-processor.ts` with 3-band EQ class
  - [x] 1.2: Implement Low shelf filter (BiquadFilterNode type: 'lowshelf', freq: 320Hz)
  - [x] 1.3: Implement Mid peaking filter (BiquadFilterNode type: 'peaking', freq: 1000Hz, Q: 0.7)
  - [x] 1.4: Implement High shelf filter (BiquadFilterNode type: 'highshelf', freq: 3200Hz)
  - [x] 1.5: Expose `setLow(db)`, `setMid(db)`, `setHigh(db)` methods (-24dB to +6dB range)
  - [x] 1.6: Chain filters: Input → Low → Mid → High → Output

- [ ] Task 2: Create Channel Strip with Gain (AC: #1, #2)
  - [ ] 2.1: Create `src/modules/audio/dsp/channel-strip.ts` class
  - [ ] 2.2: Integrate EQ processor as first stage
  - [ ] 2.3: Add GainNode for channel volume control (0.0 to 1.5 range, default 1.0)
  - [ ] 2.4: Add `setGain(value)` method with linear-to-exponential mapping
  - [ ] 2.5: Wire: DeckEngineNode → EQ → Gain → Output

- [ ] Task 3: Create Master Limiter (AC: #3)
  - [ ] 3.1: Create `src/modules/audio/dsp/master-limiter.ts` class
  - [ ] 3.2: Configure DynamicsCompressorNode with limiter-optimized settings:
    - threshold: -3 dB (brick wall)
    - knee: 0 (hard knee for limiting)
    - ratio: 20:1 (effectively limiting)
    - attack: 0.001s (1ms - fast attack)
    - release: 0.1s (100ms - moderate release)
  - [ ] 3.3: Add master GainNode before limiter for overall volume
  - [ ] 3.4: Expose `setMasterGain(value)` method
  - [ ] 3.5: Wire: Sum of all decks → Master Gain → Limiter → Destination

- [ ] Task 4: Implement Peak Metering via SharedArrayBuffer (AC: #4)
  - [ ] 4.1: Create `src/modules/audio/dsp/peak-meter.ts` class
  - [ ] 4.2: Define SharedArrayBuffer layout for 4 decks + master (5 channels × 2 floats = 40 bytes)
  - [ ] 4.3: Use AnalyserNode.getFloatTimeDomainData() to calculate RMS and peak values
  - [ ] 4.4: Write peak values atomically to SAB every animation frame (~16ms)
  - [ ] 4.5: Create `usePeakMeter(deckId)` hook for UI consumption
  - [ ] 4.6: Expose peak and RMS values for VU meter rendering

- [ ] Task 5: Integrate with DeckEngineService (AC: #1, #2, #3, #4)
  - [ ] 5.1: Update `DeckEngineService.createDeck()` to instantiate ChannelStrip per deck
  - [ ] 5.2: Create `MasterBus` class to sum all deck outputs and apply limiter
  - [ ] 5.3: Update service to route: DeckEngineNode → ChannelStrip → MasterBus → Destination
  - [ ] 5.4: Expose EQ/Gain control methods on service: `setDeckEQ(deckId, band, value)`, `setDeckGain(deckId, value)`
  - [ ] 5.5: Expose master control: `setMasterGain(value)`
  - [ ] 5.6: Initialize peak meters for each deck and master

- [ ] Task 6: Update Audio Store (AC: #4)
  - [ ] 6.1: Add EQ state to DeckState in `audio.store.ts`: `eq: { low: 0, mid: 0, high: 0 }`
  - [ ] 6.2: Add gain state: `gain: 1.0`
  - [ ] 6.3: Add master state: `masterGain: 1.0`
  - [ ] 6.4: Add actions: `setDeckEQ`, `setDeckGain`, `setMasterGain`
  - [ ] 6.5: Ensure store actions call DeckEngineService methods

- [ ] Task 7: Testing and Validation (AC: #1, #2, #3, #4)
  - [ ] 7.1: Write Vitest unit tests for EQProcessor class
  - [ ] 7.2: Write unit tests for ChannelStrip class
  - [ ] 7.3: Write unit tests for MasterLimiter class
  - [ ] 7.4: Test EQ frequency response curves match expected behavior
  - [ ] 7.5: Verify limiter prevents output exceeding 0dBFS
  - [ ] 7.6: Verify peak meter SAB updates at 60Hz+

## Dev Notes

### Critical Architecture Requirements

**Split-Brain Awareness:**
- EQ, Gain, and Limiter nodes run on the MAIN THREAD (not AudioWorklet)
- These are standard Web Audio API nodes connected in the audio graph
- Only the DeckEngineProcessor (sample playback) runs in the AudioWorklet
- The audio graph connection: `AudioWorkletNode → BiquadFilters → GainNode → DynamicsCompressor → AudioDestination`

**Performance Requirements:**
- BiquadFilterNode parameter changes are automatically smoothed by Web Audio API (no zipper noise)
- Use `exponentialRampToValueAtTime()` for gain changes to prevent clicks
- Peak meter calculations should NOT happen in the audio thread - use AnalyserNode
- SAB writes for metering must be atomic (use Atomics API)

**File Location Pattern:**
```
src/modules/audio/
├── dsp/                          # NEW: DSP processing nodes
│   ├── eq-processor.ts           # 3-band parametric EQ
│   ├── channel-strip.ts          # Per-deck EQ + Gain chain
│   ├── master-limiter.ts         # Master bus limiter
│   └── peak-meter.ts             # Peak/RMS metering
├── hooks/
│   ├── usePlayheadSync.ts        # EXISTING: Playhead SAB reader
│   └── usePeakMeter.ts           # NEW: Peak meter SAB reader
├── services/
│   ├── deck-engine.service.ts    # MODIFY: Integrate channel strips
│   └── master-bus.service.ts     # NEW: Master output management
├── worklet/
│   ├── deck-engine.processor.ts  # EXISTING: No changes needed
│   └── deck-engine.node.ts       # EXISTING: No changes needed
└── store/
    └── audio.store.ts            # MODIFY: Add EQ/gain state
```

### Web Audio API Implementation Details

**3-Band EQ Filter Chain:**
```typescript
// eq-processor.ts
class EQProcessor {
  private low: BiquadFilterNode;
  private mid: BiquadFilterNode;
  private high: BiquadFilterNode;

  constructor(context: AudioContext) {
    // Low shelf: affects frequencies below 320Hz
    this.low = context.createBiquadFilter();
    this.low.type = 'lowshelf';
    this.low.frequency.value = 320;

    // Mid peaking: centered at 1kHz with moderate Q
    this.mid = context.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.7;

    // High shelf: affects frequencies above 3.2kHz
    this.high = context.createBiquadFilter();
    this.high.type = 'highshelf';
    this.high.frequency.value = 3200;

    // Chain them
    this.low.connect(this.mid);
    this.mid.connect(this.high);
  }

  get input(): AudioNode { return this.low; }
  get output(): AudioNode { return this.high; }

  setLow(db: number) {
    // Clamp to -24dB to +6dB range
    this.low.gain.value = Math.max(-24, Math.min(6, db));
  }

  setMid(db: number) {
    this.mid.gain.value = Math.max(-24, Math.min(6, db));
  }

  setHigh(db: number) {
    this.high.gain.value = Math.max(-24, Math.min(6, db));
  }
}
```

**Limiter Configuration (Brick Wall):**
```typescript
// master-limiter.ts
class MasterLimiter {
  private compressor: DynamicsCompressorNode;
  private masterGain: GainNode;

  constructor(context: AudioContext) {
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 1.0;

    this.compressor = context.createDynamicsCompressor();
    // Brick wall limiter settings
    this.compressor.threshold.value = -3;  // Start limiting at -3dB
    this.compressor.knee.value = 0;         // Hard knee
    this.compressor.ratio.value = 20;       // Essentially infinite ratio
    this.compressor.attack.value = 0.001;   // 1ms attack
    this.compressor.release.value = 0.1;    // 100ms release

    this.masterGain.connect(this.compressor);
  }

  get input(): AudioNode { return this.masterGain; }
  get output(): AudioNode { return this.compressor; }

  setMasterGain(value: number) {
    const now = this.masterGain.context.currentTime;
    // Exponential ramp for smooth transitions (avoid clicks)
    this.masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, value), // exponentialRamp can't go to 0
      now + 0.01
    );
  }
}
```

**Peak Metering with SAB:**
```typescript
// peak-meter.ts
const METER_SAB_SIZE = 40; // 5 channels × 2 floats (peak + RMS) × 4 bytes

interface MeterData {
  peak: number;   // 0.0 to 1.0+
  rms: number;    // 0.0 to 1.0
}

class PeakMeter {
  private analyser: AnalyserNode;
  private dataArray: Float32Array;
  private sab: SharedArrayBuffer;
  private view: Float32Array;

  constructor(context: AudioContext, sab: SharedArrayBuffer, channelOffset: number) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256; // Small for performance
    this.dataArray = new Float32Array(this.analyser.fftSize);
    this.sab = sab;
    this.view = new Float32Array(sab, channelOffset * 8, 2); // 2 floats per channel
  }

  get input(): AudioNode { return this.analyser; }
  get output(): AudioNode { return this.analyser; } // Pass-through

  update() {
    this.analyser.getFloatTimeDomainData(this.dataArray);

    let peak = 0;
    let sumSquares = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const sample = Math.abs(this.dataArray[i]);
      peak = Math.max(peak, sample);
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // Atomic write to SAB (use regular writes - Float32 aligned)
    this.view[0] = peak;
    this.view[1] = rms;
  }
}
```

### Audio Graph Topology

```
┌─────────────────────────────────────────────────────────────┐
│                        DECK A                                │
│  DeckEngineNode → EQ(L/M/H) → Gain → [PeakMeter] ──────┐    │
└─────────────────────────────────────────────────────────┘    │
                                                               │
┌─────────────────────────────────────────────────────────┐    │    ┌─────────────────┐
│                        DECK B                            │    ├───→│   Master Bus    │
│  DeckEngineNode → EQ(L/M/H) → Gain → [PeakMeter] ──────┤    │    │  (Sum all decks)│
└─────────────────────────────────────────────────────────┘    │    │        ↓        │
                                                               │    │   Master Gain   │
┌─────────────────────────────────────────────────────────┐    │    │        ↓        │
│                        DECK C                            │    │    │    Limiter     │
│  DeckEngineNode → EQ(L/M/H) → Gain → [PeakMeter] ──────┤    │    │        ↓        │
└─────────────────────────────────────────────────────────┘    │    │  [PeakMeter]   │
                                                               │    │        ↓        │
┌─────────────────────────────────────────────────────────┐    │    │  Destination   │
│                        DECK D                            │    │    └─────────────────┘
│  DeckEngineNode → EQ(L/M/H) → Gain → [PeakMeter] ──────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Previous Story Intelligence (Story 3.1)

**What was built:**
- `DeckEngineProcessor` - AudioWorklet for sample-accurate playback
- `DeckEngineNode` - Main thread wrapper with transport controls
- `DeckEngineService` - Singleton managing 4 decks
- SharedArrayBuffer playhead sync working at 60Hz+
- High-quality sample rate conversion via OfflineAudioContext

**Files created in 3.1:**
- `src/modules/audio/worklet/deck-engine.processor.ts`
- `src/modules/audio/worklet/deck-engine.node.ts`
- `src/modules/audio/services/deck-engine.service.ts`
- `public/deck-engine.processor.js`

**Key learnings:**
- Processor code cannot import from main thread modules
- SAB layout uses sequence counter for torn-read prevention
- All 10 unit tests pass, no regressions
- Per-deck volume control already added (`setDeckVolume`/`getDeckVolume`)

**IMPORTANT:** Story 3.1 already added basic volume control to DeckEngineService. This story extends that with proper EQ and master bus architecture.

### Existing Code to Integrate With

**DeckEngineService (from 3.1):**
```typescript
// Current interface - EXTEND this
class DeckEngineService {
  private nodes: Map<DeckId, DeckEngineNode>;

  async createDeck(deckId: DeckId): Promise<DeckEngineNode>;
  getDeck(deckId: DeckId): DeckEngineNode | undefined;
  setDeckVolume(deckId: DeckId, volume: number): void;
  getDeckVolume(deckId: DeckId): number;
  dispose(): void;
}
```

**Audio Store State (current):**
```typescript
interface DeckState {
  trackId: number | null;
  trackTitle: string;
  position: number;
  duration: number;
  waveform: Float32Array | null;
  beatgrid: BeatgridData | null;
  cues: CuePoint[];
  loops: Loop[];
  stems: StemState | null;
  isSlipMode: boolean;
}
```

**Add to DeckState:**
```typescript
interface DeckState {
  // ... existing fields
  eq: { low: number; mid: number; high: number }; // dB values
  gain: number; // 0.0 to 1.5
}

interface AudioStore {
  // ... existing state
  masterGain: number; // 0.0 to 1.5

  // New actions
  setDeckEQ: (deckId: DeckId, band: 'low' | 'mid' | 'high', db: number) => void;
  setDeckGain: (deckId: DeckId, value: number) => void;
  setMasterGain: (value: number) => void;
}
```

### SharedArrayBuffer Layout for Metering

```typescript
// Extend existing SAB or create new one for metering
const METER_SAB_LAYOUT = {
  // 5 channels: Deck A, B, C, D, Master
  // Each channel: 2 Float32 values (peak, rms)
  DECK_A_PEAK: 0,
  DECK_A_RMS: 4,
  DECK_B_PEAK: 8,
  DECK_B_RMS: 12,
  DECK_C_PEAK: 16,
  DECK_C_RMS: 20,
  DECK_D_PEAK: 24,
  DECK_D_RMS: 28,
  MASTER_PEAK: 32,
  MASTER_RMS: 36,
  TOTAL_SIZE: 40, // bytes
};
```

### Project Structure Notes

- Place all DSP classes in new `src/modules/audio/dsp/` directory
- Follow existing pattern: one class per file, exported from `src/modules/audio/index.ts`
- Tests go in same directory with `.test.ts` suffix
- Hooks go in `src/modules/audio/hooks/`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Pipeline] - Hybrid Messaging Protocol
- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Performance] - Zero allocation rule
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2] - Original acceptance criteria
- [Source: _bmad-output/implementation-artifacts/3-1-audioworklet-deck-engine.md] - Previous story implementation
- [Source: src/modules/audio/services/deck-engine.service.ts] - Existing service to extend
- [Source: src/modules/audio/hooks/usePlayheadSync.ts] - SAB pattern reference
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-17 | Story created via create-story workflow | Claude Opus 4.5 |
