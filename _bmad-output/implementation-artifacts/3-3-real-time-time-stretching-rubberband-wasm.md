# Story 3.3: Real-Time Time-Stretching (Rubberband WASM)

Status: ready-for-dev

## Story

As a user,
I want to change the tempo of a track without changing its musical pitch (Keylock),
So that I can mix tracks of different BPMs while maintaining harmonic compatibility.

## Acceptance Criteria

1. **Given** the AudioWorklet engine from Story 3.1
   **When** I activate "Keylock" and adjust the tempo slider
   **Then** the `AudioWorklet` must process the audio buffer through a WASM-compiled `Rubberband` library instance

2. **Given** the Rubberband time-stretcher is active
   **When** I adjust the tempo slider
   **Then** it must allow independent manipulation of tempo in real-time without affecting pitch

3. **Given** the Rubberband time-stretcher is active
   **When** I adjust the pitch knob
   **Then** it must allow independent manipulation of pitch in real-time without affecting tempo

4. **Given** various tempo adjustments
   **When** audio is played at +/- 20% tempo change
   **Then** the audio quality must match "professional grade" standards with minimal artifacts

## Tasks / Subtasks

- [ ] Task 1: Install and configure Rubberband WASM (AC: #1)
  - [ ] 1.1: Research and select appropriate Rubberband WASM package (rubberband-wasm, @nicewook/rubberband-web, or custom build)
  - [ ] 1.2: Install chosen package and verify WASM module loading
  - [ ] 1.3: Create TypeScript type definitions if not provided
  - [ ] 1.4: Configure Vite for WASM module bundling with proper headers

- [ ] Task 2: Create TimeStretchProcessor class (AC: #1, #2, #3)
  - [ ] 2.1: Create `src/modules/audio/dsp/time-stretch-processor.ts`
  - [ ] 2.2: Initialize Rubberband instance with real-time options:
    - `OptionProcessRealTime` - No study pass, immediate processing
    - `OptionEngineFaster` - R2 engine for lower latency
    - `OptionPitchHighConsistency` - Stable pitch during ratio changes
  - [ ] 2.3: Implement `setTimeRatio(ratio: number)` method:
    - ratio < 1.0 = faster tempo (0.5 = 2x speed)
    - ratio > 1.0 = slower tempo (2.0 = half speed)
    - Range: 0.5 to 2.0 (50% to 200% original tempo)
  - [ ] 2.4: Implement `setPitchScale(scale: number)` method:
    - Formula: `Math.pow(2.0, semitones / 12.0)`
    - Range: -12 to +12 semitones (1 octave)
  - [ ] 2.5: Implement `setSemitonePitch(semitones: number)` convenience method
  - [ ] 2.6: Implement `process(input: Float32Array[], output: Float32Array[])` method
  - [ ] 2.7: Handle variable output size (Rubberband may return more/fewer samples than input)
  - [ ] 2.8: Implement ring buffer for output smoothing

- [ ] Task 3: Create TimeStretchNode wrapper for main thread (AC: #1)
  - [ ] 3.1: Create `src/modules/audio/dsp/time-stretch-node.ts`
  - [ ] 3.2: Manage WASM module lifecycle (load, initialize, dispose)
  - [ ] 3.3: Expose parameter controls: `timeRatio`, `pitchScale`, `keylockEnabled`
  - [ ] 3.4: Use `ScriptProcessorNode` or `AudioWorkletNode` pattern for real-time processing
  - [ ] 3.5: Implement bypass mode when keylock is disabled (pass-through for efficiency)

- [ ] Task 4: Integrate with DeckEngineProcessor (AC: #1, #2, #3)
  - [ ] 4.1: Modify `deck-engine.processor.ts` to optionally pipe audio through time-stretcher
  - [ ] 4.2: Add message handlers: `SET_TIME_RATIO`, `SET_PITCH_SCALE`, `ENABLE_KEYLOCK`
  - [ ] 4.3: Update SharedArrayBuffer layout to include tempo/pitch state if needed
  - [ ] 4.4: Handle latency compensation (Rubberband introduces processing delay)
  - [ ] 4.5: Ensure zero-allocation in process loop (pre-allocate all buffers)

- [ ] Task 5: Update DeckEngineService (AC: #1, #2, #3)
  - [ ] 5.1: Add `setDeckTimeRatio(deckId, ratio)` method
  - [ ] 5.2: Add `setDeckPitchScale(deckId, scale)` method
  - [ ] 5.3: Add `setDeckKeylock(deckId, enabled)` method
  - [ ] 5.4: Add `setDeckSemitones(deckId, semitones)` convenience method
  - [ ] 5.5: Calculate effective BPM: `effectiveBpm = originalBpm / timeRatio`

- [ ] Task 6: Update Audio Store (AC: #1, #2, #3)
  - [ ] 6.1: Add to DeckState interface:
    ```typescript
    timeRatio: number;      // 0.5 to 2.0, default 1.0
    pitchScale: number;     // 0.5 to 2.0, default 1.0
    keylockEnabled: boolean; // default false
    semitones: number;      // -12 to +12, derived from pitchScale
    effectiveBpm: number;   // originalBpm / timeRatio
    ```
  - [ ] 6.2: Add actions: `setDeckTimeRatio`, `setDeckPitchScale`, `setDeckKeylock`
  - [ ] 6.3: Ensure store syncs with service on state changes

- [ ] Task 7: Testing and Validation (AC: #1, #2, #3, #4)
  - [ ] 7.1: Write unit tests for TimeStretchProcessor class
  - [ ] 7.2: Test time ratio changes at 0.8, 1.0, 1.2 (±20%)
  - [ ] 7.3: Test pitch scale changes at semitone intervals
  - [ ] 7.4: Verify audio quality meets professional standards (subjective listening test)
  - [ ] 7.5: Test CPU usage under load (should remain <30% per deck)
  - [ ] 7.6: Verify no audio glitches during ratio transitions

## Dev Notes

### Critical Architecture Requirements

**Split-Brain Awareness:**
- Time-stretching is computationally intensive
- Option A: Run Rubberband in a dedicated Web Worker, stream processed audio to AudioWorklet
- Option B: Run Rubberband directly in AudioWorklet (requires WASM in worklet context)
- Option B is preferred for lower latency but requires careful WASM loading

**Performance Requirements:**
- Rubberband processing must complete within audio quantum (2.9ms at 44.1kHz/128 samples)
- Pre-allocate all input/output buffers to avoid GC in audio thread
- Use ring buffers to handle variable output sizes
- Consider using `OptionEngineFaster` (R2) over `OptionEngineFiner` (R3) for real-time use

**Rubberband WASM Loading Strategy:**
```typescript
// In AudioWorklet context, WASM must be loaded differently
// Option 1: Instantiate in main thread, transfer to worklet
// Option 2: Fetch WASM binary and instantiate in worklet

// Worklet loading (preferred):
const wasmBinary = await fetch('/rubberband.wasm').then(r => r.arrayBuffer());
const rubberband = await RubberbandModule({ wasmBinary });
```

**File Location Pattern:**
```
src/modules/audio/
├── dsp/
│   ├── time-stretch-processor.ts    # NEW: Core Rubberband wrapper
│   ├── time-stretch-processor.test.ts
│   ├── time-stretch-node.ts         # NEW: Main thread node wrapper
│   ├── eq-processor.ts              # EXISTING
│   ├── channel-strip.ts             # EXISTING
│   ├── master-limiter.ts            # EXISTING
│   └── peak-meter.ts                # EXISTING
├── worklet/
│   ├── deck-engine.processor.ts     # MODIFY: Integrate time-stretching
│   └── deck-engine.node.ts          # MODIFY: Add timeRatio/pitch controls
├── services/
│   ├── deck-engine.service.ts       # MODIFY: Add time-stretch methods
│   └── rubberband-loader.service.ts # NEW: WASM module loader
└── store/
    └── audio.store.ts               # MODIFY: Add time-stretch state
```

### Rubberband API Reference

**Core Concepts:**
- `timeRatio`: Stretched duration / original duration
  - 1.0 = original speed
  - 0.5 = 2x faster (half duration)
  - 2.0 = 2x slower (double duration)
- `pitchScale`: Frequency multiplier
  - 1.0 = original pitch
  - 2.0 = one octave up
  - 0.5 = one octave down
  - Formula: `Math.pow(2.0, semitones / 12.0)`

**Key Options (C enum to JS flags):**
```typescript
const RubberbandOptions = {
  OptionProcessRealTime: 0x00000001,      // Required for live use
  OptionEngineFaster: 0x00000200,          // R2 engine (lower latency)
  OptionEngineFiner: 0x00000300,           // R3 engine (higher quality)
  OptionPitchHighConsistency: 0x02000000,  // Stable pitch during changes
  OptionFormantPreserved: 0x01000000,      // Keep vocal character
};
```

**Processing Loop Pattern:**
```typescript
class TimeStretchProcessor {
  private stretcher: RubberbandStretcher;
  private inputBuffer: Float32Array[];
  private outputBuffer: Float32Array[];

  constructor(sampleRate: number, channels: number) {
    this.stretcher = new RubberbandStretcher(
      sampleRate,
      channels,
      RubberbandOptions.OptionProcessRealTime |
      RubberbandOptions.OptionEngineFaster |
      RubberbandOptions.OptionPitchHighConsistency,
      1.0,  // initial timeRatio
      1.0   // initial pitchScale
    );

    // Pre-allocate buffers
    const blockSize = 512;
    this.inputBuffer = [new Float32Array(blockSize), new Float32Array(blockSize)];
    this.outputBuffer = [new Float32Array(blockSize * 4), new Float32Array(blockSize * 4)];
  }

  setTimeRatio(ratio: number): void {
    // Clamp to safe range
    const clamped = Math.max(0.5, Math.min(2.0, ratio));
    this.stretcher.setTimeRatio(clamped);
  }

  setPitchScale(scale: number): void {
    const clamped = Math.max(0.5, Math.min(2.0, scale));
    this.stretcher.setPitchScale(clamped);
  }

  process(input: Float32Array[], output: Float32Array[]): number {
    // Feed input to stretcher
    this.stretcher.process(input, input[0].length, false);

    // Retrieve available output
    const available = this.stretcher.available();
    if (available > 0) {
      return this.stretcher.retrieve(output, available);
    }
    return 0;
  }
}
```

### Audio Graph Topology (Updated)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DECK A (with Keylock)                          │
│                                                                             │
│  AudioBuffer → [TimeStretch*] → DeckEngineNode → EQ → Gain → [PeakMeter]   │
│                    ↑                                                        │
│                    │                                                        │
│             (bypassed when                                                  │
│              keylock=false)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
                            ┌─────────────────┐
                            │   Master Bus    │
                            │        ↓        │
                            │   Master Gain   │
                            │        ↓        │
                            │    Limiter      │
                            │        ↓        │
                            │   Destination   │
                            └─────────────────┘

* TimeStretch processing happens BEFORE DeckEngineNode output
  (either in the processor itself or as pre-processing)
```

### Previous Story Intelligence (Story 3.2)

**What was built:**
- `EQProcessor` - 3-band parametric EQ (Low 320Hz, Mid 1kHz, High 3.2kHz)
- `ChannelStrip` - Per-deck EQ + Gain chain
- `MasterLimiter` - Brick wall limiter (-3dB threshold, 20:1 ratio)
- `PeakMeter` - SharedArrayBuffer metering at 60Hz
- `MasterBus` - Sum all decks with limiter

**Key Learnings from 3.2:**
- DSP nodes run on MAIN THREAD (not AudioWorklet) - connected via Web Audio graph
- Only DeckEngineProcessor runs in AudioWorklet for sample playback
- exponentialRampToValueAtTime() prevents clicks on gain changes
- 61 unit tests added, 363 total pass
- Service methods update both audio graph AND Zustand store

**Files modified in 3.2:**
- `src/modules/audio/services/deck-engine.service.ts` - Channel strip integration
- `src/modules/audio/store/audio.store.ts` - EQ/gain state

**IMPORTANT:** Story 3.2 established the pattern of DSP on main thread. Time-stretching may need to break this pattern due to computational intensity - evaluate both approaches.

### WASM Package Options

**Option 1: @nicewook/rubberband-web (Recommended)**
- Pre-built WASM with TypeScript bindings
- npm install @nicewook/rubberband-web
- Includes Emscripten glue code

**Option 2: rubberband-wasm**
- Minimal WASM build
- May require manual type definitions

**Option 3: Custom WASM Build**
- Clone Rubberband source, compile with Emscripten
- Most control, most effort
- Useful if other packages don't meet needs

**Recommended Approach:**
Start with @nicewook/rubberband-web. If performance or API issues arise, evaluate custom build.

### Latency Considerations

**Rubberband introduces processing latency:**
- R2 (Faster) engine: ~50-100ms latency
- R3 (Finer) engine: ~100-200ms latency
- `getStartDelay()` returns the exact latency in samples

**Latency Compensation:**
```typescript
const startDelay = stretcher.getStartDelay();
// Offset playhead position by startDelay samples when rendering UI
// This keeps waveform position visually accurate despite processing delay
```

### Integration Strategy

**Phase 1: Standalone Testing**
1. Create TimeStretchProcessor class with Rubberband
2. Test with offline processing (not real-time)
3. Verify quality at ±20% tempo

**Phase 2: Real-Time Integration**
1. Integrate into DeckEngineProcessor or create separate node
2. Handle variable output buffering
3. Test real-time performance

**Phase 3: UI Integration**
1. Add tempo/pitch controls to store
2. Wire up service methods
3. Test full flow

### Project Structure Notes

- Follow existing `src/modules/audio/dsp/` pattern for new DSP classes
- Tests in same directory with `.test.ts` suffix
- Export from `src/modules/audio/index.ts`
- WASM files go in `public/` for Vite serving

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Pipeline] - Hybrid Messaging Protocol
- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Performance] - Zero allocation rule
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3] - Original acceptance criteria
- [Source: _bmad-output/implementation-artifacts/3-2-3-band-eq-master-limiter.md] - Previous story patterns
- [Source: src/modules/audio/worklet/deck-engine.processor.ts] - Current AudioWorklet implementation
- [Source: src/modules/audio/services/deck-engine.service.ts] - Service to extend
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Rubberband Documentation: https://breakfastquay.com/rubberband/] - Official API reference

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
