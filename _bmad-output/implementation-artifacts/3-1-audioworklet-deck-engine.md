# Story 3.1: AudioWorklet Deck Engine

Status: review

## Story

As a developer,
I want to implement a sample-accurate audio engine in an `AudioWorklet`,
So that playback remains glitch-free even during heavy UI rendering or garbage collection.

## Acceptance Criteria

1. **Given** the "Split-Brain" architecture from Epic 1
   **When** a track is loaded into a deck
   **Then** the `AudioWorkletNode` must handle the audio buffer processing in a high-priority thread

2. **Given** a track loaded in the AudioWorklet
   **When** the user interacts with transport controls
   **Then** the system must support Play, Pause, Cue, and Seek operations with <16ms latency

3. **Given** the AudioWorklet is processing audio
   **When** the UI needs playhead position data
   **Then** the worklet must provide high-resolution playhead position data to the UI via `SharedArrayBuffer`

4. **Given** audio files with various sample rates (44.1kHz, 48kHz, 96kHz)
   **When** the track is played through the AudioWorklet
   **Then** the system must handle sample-rate conversion to ensure tracks play correctly regardless of hardware output settings

## Tasks / Subtasks

- [ ] Task 1: Create AudioWorklet Processor (AC: #1)
  - [ ] 1.1: Create `src/modules/audio/worklet/deck-engine.processor.ts`
  - [ ] 1.2: Implement `AudioWorkletProcessor` class with `process()` method
  - [ ] 1.3: Implement ring buffer for audio sample storage
  - [ ] 1.4: Handle buffer underrun gracefully (output silence, no glitches)
  - [ ] 1.5: Register processor with `registerProcessor('deck-engine', DeckEngineProcessor)`

- [ ] Task 2: Create AudioWorklet Node Wrapper (AC: #1, #2)
  - [ ] 2.1: Create `src/modules/audio/worklet/deck-engine.node.ts`
  - [ ] 2.2: Implement `DeckEngineNode` class extending `AudioWorkletNode`
  - [ ] 2.3: Implement `loadBuffer(audioBuffer: AudioBuffer)` method
  - [ ] 2.4: Implement transport API: `play()`, `pause()`, `stop()`, `seek(position: number)`
  - [ ] 2.5: Implement `setCuePoint(position: number)` and `jumpToCue()` methods
  - [ ] 2.6: Ensure all commands execute with <16ms latency using port.postMessage

- [ ] Task 3: SharedArrayBuffer Playhead Integration (AC: #3)
  - [ ] 3.1: Integrate with existing `PlayheadWriter` from `src/modules/audio/hooks/usePlayheadSync.ts`
  - [ ] 3.2: Pass SharedArrayBuffer to processor via constructor options
  - [ ] 3.3: Write playhead position atomically every process() call (~2.9ms at 128 samples/44.1kHz)
  - [ ] 3.4: Ensure UI can read playhead via existing `PlayheadReader` class
  - [ ] 3.5: Update existing `usePlayheadSync` hook to accept deck-engine as source

- [ ] Task 4: Sample Rate Conversion (AC: #4)
  - [ ] 4.1: Detect source audio sample rate from AudioBuffer.sampleRate
  - [ ] 4.2: Detect output sample rate from AudioContext.sampleRate
  - [ ] 4.3: Implement linear interpolation resampler for rate conversion
  - [ ] 4.4: Alternatively use `OfflineAudioContext` for high-quality pre-conversion
  - [ ] 4.5: Test with 44.1kHz, 48kHz, and 96kHz source files

- [ ] Task 5: Integration with Existing Infrastructure (AC: #1, #2)
  - [ ] 5.1: Create `src/modules/audio/services/deck-engine.service.ts` for lifecycle management
  - [ ] 5.2: Integrate with `audio.store.ts` for deck state updates
  - [ ] 5.3: Add worklet module loading via `audioContext.audioWorklet.addModule()`
  - [ ] 5.4: Ensure processor file is served correctly by Vite (may need `/public` or worker build config)
  - [ ] 5.5: Update `DeckUI` component to use new deck engine

- [ ] Task 6: Testing and Validation (AC: #1, #2, #3, #4)
  - [ ] 6.1: Write Vitest unit tests for DeckEngineNode API
  - [ ] 6.2: Test transport controls respond within 16ms
  - [ ] 6.3: Verify SharedArrayBuffer playhead updates at 60Hz+ rate
  - [ ] 6.4: Test sample rate conversion with various source files
  - [ ] 6.5: Verify no audio dropouts during heavy UI rendering

## Dev Notes

### Critical Architecture Requirements

**Split-Brain Isolation (MANDATORY):**
- AudioWorklet processor code (`deck-engine.processor.ts`) MUST NOT import React, DOM types, or UI stores
- Processor runs in a separate high-priority audio rendering thread
- All communication must be via `port.postMessage()` or `SharedArrayBuffer`

**Performance Requirements:**
- Zero allocation in the `process()` render loop - pre-allocate all buffers
- Never block the audio thread with synchronous operations
- Use `SharedArrayBuffer` for high-frequency data (playhead), `postMessage` for commands

**File Location Pattern:**
```
src/modules/audio/
├── worklet/
│   ├── deck-engine.processor.ts   # AudioWorkletProcessor (worker realm)
│   └── deck-engine.node.ts        # AudioWorkletNode wrapper (main thread)
├── services/
│   └── deck-engine.service.ts     # Lifecycle management
└── hooks/
    └── usePlayheadSync.ts         # Already exists - integrate with it
```

### Existing Infrastructure to Use

**SharedArrayBuffer Layout (from usePlayheadSync.ts):**
```typescript
// 40 bytes total allocation
const SEQUENCE_OFFSET = 0;    // Int32 - atomic consistency
const POSITION_OFFSET = 8;    // Float64 - position in samples
const SAMPLE_RATE_OFFSET = 16; // Float64
const DURATION_OFFSET = 24;   // Float64
const IS_PLAYING_OFFSET = 32; // Int32
```

**PlayheadWriter class** - Already exists, use in processor:
```typescript
// In processor process() method:
this.playheadWriter.write(currentSamplePosition, sampleRate, totalDuration, isPlaying);
```

**PlayheadReader class** - Already exists, UI uses this via hook

**Audio Store (Zustand)** - Use for deck state:
```typescript
// From src/modules/audio/store/audio.store.ts
interface DeckState {
  trackId: number | null;
  trackTitle: string;
  position: number;        // Will be updated from SAB
  duration: number;
  waveform: Float32Array | null;
  beatgrid: BeatgridData | null;
  cues: CuePoint[];
  loops: Loop[];
  stems: StemState | null;
  isSlipMode: boolean;
}
```

### AudioWorklet Processor Pattern

```typescript
// deck-engine.processor.ts
class DeckEngineProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array[][] = [];  // [channel][samples]
  private playhead = 0;
  private isPlaying = false;
  private sampleRate = 44100;
  private playheadWriter: PlayheadWriter;

  constructor(options: AudioWorkletNodeOptions) {
    super();
    // Initialize SAB from options.processorOptions
    const sab = options.processorOptions?.sharedArrayBuffer;
    if (sab) {
      this.playheadWriter = new PlayheadWriter(sab);
    }
    this.port.onmessage = this.handleMessage.bind(this);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const output = outputs[0];

    if (!this.isPlaying || !this.buffer.length) {
      // Output silence
      for (const channel of output) {
        channel.fill(0);
      }
    } else {
      // Copy samples from ring buffer to output
      for (let ch = 0; ch < output.length; ch++) {
        for (let i = 0; i < output[ch].length; i++) {
          const sampleIndex = this.playhead + i;
          if (sampleIndex < this.buffer[ch].length) {
            output[ch][i] = this.buffer[ch][sampleIndex];
          } else {
            output[ch][i] = 0; // End of track
          }
        }
      }
      this.playhead += output[0].length;
    }

    // Update SAB playhead (atomic, <16ms)
    if (this.playheadWriter) {
      this.playheadWriter.write(this.playhead, this.sampleRate, this.duration, this.isPlaying);
    }

    return true; // Keep processor alive
  }

  private handleMessage(event: MessageEvent) {
    const { type, payload } = event.data;
    switch (type) {
      case 'LOAD_BUFFER':
        this.loadBuffer(payload);
        break;
      case 'PLAY':
        this.isPlaying = true;
        break;
      case 'PAUSE':
        this.isPlaying = false;
        break;
      case 'SEEK':
        this.playhead = payload.position;
        break;
      case 'CUE':
        this.cuePoint = payload.position;
        break;
      case 'JUMP_TO_CUE':
        this.playhead = this.cuePoint;
        break;
    }
  }
}

registerProcessor('deck-engine', DeckEngineProcessor);
```

### Vite Configuration for AudioWorklet

AudioWorklet modules need special handling. Add to `vite.config.ts`:
```typescript
export default defineConfig({
  // ... existing config
  optimizeDeps: {
    exclude: ['deck-engine.processor'] // Don't bundle processor
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'deck-engine.processor': './src/modules/audio/worklet/deck-engine.processor.ts'
      }
    }
  }
});
```

Or place processor in `/public` folder and load via URL:
```typescript
await audioContext.audioWorklet.addModule('/deck-engine.processor.js');
```

### Transport Control Latency

For <16ms latency, use immediate `postMessage`:
```typescript
// deck-engine.node.ts
class DeckEngineNode extends AudioWorkletNode {
  play() {
    this.port.postMessage({ type: 'PLAY' });
  }

  pause() {
    this.port.postMessage({ type: 'PAUSE' });
  }

  seek(positionSamples: number) {
    this.port.postMessage({ type: 'SEEK', payload: { position: positionSamples } });
  }
}
```

### Sample Rate Conversion Options

**Option A: Linear Interpolation (Real-time, lower quality)**
```typescript
function resample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const frac = srcIndex - floor;
    output[i] = input[floor] * (1 - frac) + (input[floor + 1] || 0) * frac;
  }
  return output;
}
```

**Option B: OfflineAudioContext (Pre-conversion, high quality)**
```typescript
async function resampleBuffer(buffer: AudioBuffer, targetRate: number): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.duration * targetRate),
    targetRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  return await offlineCtx.startRendering();
}
```

**Recommendation:** Use Option B (OfflineAudioContext) during track load for quality, as DJ audio quality is paramount.

### Project Structure Notes

- AudioWorklet files go in `src/modules/audio/worklet/`
- Service layer goes in `src/modules/audio/services/`
- Worker realm code (processor) cannot import from UI realm
- Use `src/shared/` for types shared between realms

### Testing Strategy

```typescript
// deck-engine.test.ts
describe('DeckEngineNode', () => {
  let audioContext: AudioContext;
  let deckEngine: DeckEngineNode;

  beforeAll(async () => {
    audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule('/deck-engine.processor.js');
    deckEngine = new DeckEngineNode(audioContext);
  });

  it('should load audio buffer', async () => {
    const buffer = await loadTestAudioBuffer();
    await deckEngine.loadBuffer(buffer);
    expect(deckEngine.duration).toBe(buffer.duration);
  });

  it('should update playhead position via SharedArrayBuffer', async () => {
    deckEngine.play();
    await waitFor(100); // 100ms
    const position = deckEngine.getPlayheadPosition();
    expect(position).toBeGreaterThan(0);
  });
});
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Pipeline] - Hybrid Messaging Protocol (SAB + postMessage)
- [Source: _bmad-output/planning-artifacts/architecture.md#Thread Boundaries] - Worker realm restrictions
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] - Direct Worker Access pattern
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] - Original acceptance criteria
- [Source: src/modules/audio/hooks/usePlayheadSync.ts] - Existing SharedArrayBuffer infrastructure
- [Source: src/modules/audio/store/audio.store.ts] - Deck state management
- [Source: src/modules/audio/services/stem-mixer.service.ts] - Current Web Audio API usage pattern (to be augmented)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
