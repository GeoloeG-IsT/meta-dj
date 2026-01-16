# Story 2.2: Automated Track Analysis (BPM/Key/Grid)

Status: review

## Story

As a user,
I want the system to automatically calculate the BPM, Key, and Beatgrid for my music,
So that I have accurate data for syncing and performance without manual entry.

## Acceptance Criteria

1. **WASM-Based Analysis Engine:** Given an ingested track with no analysis data, when I trigger a "Track Analysis" action, then the system must utilize a WASM-compiled library (essentia.js or similar) to detect BPM and musical Key. [Source: epics.md#Story 2.2]

2. **Beatgrid Generation:** The system must generate a `beatData` binary blob containing beatgrid anchors (beat positions in samples) that can be used for sync and visualization. [Source: epics.md#Story 2.2]

3. **Database Persistence:** The analysis data must be stored in the `PerformanceData` table of the database with appropriate type indicators (type=3 for Beatgrid). [Source: epics.md#Story 2.2, engine-dj-schema.sql]

4. **UI Update:** The system must update the Track table with the detected BPM (integer) and Camelot Key (e.g., "8A") and reflect changes in the UI instantly. [Source: epics.md#Story 2.2]

5. **Background Processing:** Analysis must run in a Worker context without blocking the main thread or audio playback. [Source: architecture.md#Split-Brain, project-context.md#Audio Performance]

6. **Progress Feedback:** The UI must show analysis progress (0-100%) with stage indicators (decoding, analyzing, storing). [Source: architecture.md#Optimistic UI Patterns]

## Tasks / Subtasks

- [x] **Task 1: Integrate essentia.js WASM Module** (AC: 1, 5)
  - [x] Add essentia.js WASM package to dependencies
  - [x] Create `src/modules/audio/analysis/track-analyzer.ts` for BPM/Key detection
  - [x] Initialize Essentia WASM module in worker context (lazy load)
  - [x] Implement mono audio conversion for analysis input
  - [x] Handle WASM memory management (avoid leaks)

- [x] **Task 2: BPM Detection Implementation** (AC: 1, 4)
  - [x] Implement `detectBPM(samples: Float32Array, sampleRate: number)` using RhythmExtractor
  - [x] Add confidence scoring for BPM detection (0-1 range)
  - [x] Round BPM to nearest integer for Track table compatibility
  - [x] Support BPM range limits (60-200 BPM typical for DJ music)
  - [x] Add unit tests for BPM detection accuracy

- [x] **Task 3: Key Detection Implementation** (AC: 1, 4)
  - [x] Implement `detectKey(samples: Float32Array, sampleRate: number)` using KeyExtractor
  - [x] Convert detected key to Camelot notation (e.g., "8A", "11B")
  - [x] Map standard key names (C major, A minor) to Camelot wheel
  - [x] Add confidence scoring for key detection
  - [x] Add unit tests for key detection

- [x] **Task 4: Beatgrid Generation** (AC: 2, 3)
  - [x] Implement `generateBeatgrid(samples: Float32Array, sampleRate: number, bpm: number)`
  - [x] Detect beat positions using onset detection + tempo alignment
  - [x] Generate beatgrid anchors array (sample positions)
  - [x] Create binary serialization format for beatData blob
  - [x] Implement downbeat detection (first beat of bar)
  - [x] Add unit tests for beatgrid accuracy

- [x] **Task 5: Database Integration** (AC: 3, 4)
  - [x] Add database service methods for storing analysis results
  - [x] Update Track table: `bpm`, `key`, `isAnalyzed` fields
  - [x] Insert PerformanceData row with type=3 (Beatgrid), data=beatData blob
  - [x] Implement transactional writes (Track + PerformanceData together)
  - [x] Add migration check for any schema updates

- [x] **Task 6: Worker Integration & Progress** (AC: 5, 6)
  - [x] Add `TRACK_ANALYSIS_REQUEST` message type to messaging.ts
  - [x] Add `TRACK_ANALYSIS_PROGRESS` message type for progress updates
  - [x] Add `TRACK_ANALYSIS_COMPLETE` message type for results
  - [x] Implement progress calculation (decoding: 0-20%, analyzing: 20-80%, storing: 80-100%)
  - [x] Handle analysis cancellation for track unload scenarios

- [x] **Task 7: UI Integration** (AC: 4, 6)
  - [x] Add `analyzeTrack(trackId: number)` action to audio store
  - [x] Create analysis progress indicator component
  - [x] Update track list to show BPM/Key after analysis
  - [x] Add "Analyze" context menu option or button
  - [x] Handle bulk analysis queue for multiple tracks

## Dev Notes

### Critical Architecture Compliance

**Split-Brain Pattern (MANDATORY):**
- ALL audio analysis computations MUST run in Worker context
- The TrackAnalyzer class belongs in `modules/audio/analysis/` (runs in worker)
- UI components only receive progress updates and final results via postMessage
- NEVER load WASM modules on the main thread

**Thread Boundaries:**
```
[Main Thread] --TRACK_ANALYSIS_REQUEST--> [Database Worker]
[Database Worker] --decode audio--> [TrackAnalyzer]
[TrackAnalyzer] --progress updates--> [Main Thread]
[TrackAnalyzer] --results--> [Database Worker] --persist--> [Main Thread]
```

### essentia.js Integration

essentia.js is the recommended library for browser-based audio analysis:

```typescript
// Initialize essentia.js WASM
import { Essentia, EssentiaWASM } from 'essentia.js';

let essentia: Essentia | null = null;

async function initEssentia(): Promise<Essentia> {
  if (!essentia) {
    const wasmModule = await EssentiaWASM();
    essentia = new Essentia(wasmModule);
  }
  return essentia;
}

// BPM Detection
function detectBPM(audioVector: Float32Array): { bpm: number; confidence: number } {
  const rhythmExtractor = essentia.RhythmExtractor2013(audioVector);
  return {
    bpm: Math.round(rhythmExtractor.bpm),
    confidence: rhythmExtractor.confidence / 5.32, // Normalize to 0-1
  };
}

// Key Detection
function detectKey(audioVector: Float32Array): { key: string; scale: string } {
  const keyResult = essentia.KeyExtractor(audioVector);
  return {
    key: keyResult.key,      // e.g., "C"
    scale: keyResult.scale,  // e.g., "major" or "minor"
  };
}
```

### Camelot Wheel Mapping

```typescript
const CAMELOT_WHEEL: Record<string, string> = {
  // Major keys
  'C major': '8B', 'G major': '9B', 'D major': '10B', 'A major': '11B',
  'E major': '12B', 'B major': '1B', 'F# major': '2B', 'Db major': '3B',
  'Ab major': '4B', 'Eb major': '5B', 'Bb major': '6B', 'F major': '7B',
  // Minor keys
  'A minor': '8A', 'E minor': '9A', 'B minor': '10A', 'F# minor': '11A',
  'C# minor': '12A', 'G# minor': '1A', 'D# minor': '2A', 'Bb minor': '3A',
  'F minor': '4A', 'C minor': '5A', 'G minor': '6A', 'D minor': '7A',
};

function toCamelot(key: string, scale: string): string {
  const lookup = `${key} ${scale}`;
  return CAMELOT_WHEEL[lookup] || 'Unknown';
}
```

### Beatgrid Binary Format

```typescript
interface BeatgridData {
  version: number;       // Format version (1)
  bpm: number;           // Detected BPM (float)
  firstBeatSample: number; // Sample position of first beat
  beatCount: number;     // Total number of beats
  anchors: number[];     // Array of beat sample positions
}

// Serialization (matches Engine DJ format expectations)
function serializeBeatgrid(data: BeatgridData): Uint8Array {
  // Header: version(1) + bpm(4) + firstBeat(4) + count(4) = 13 bytes
  // Data: anchors (count * 4 bytes each)
  const headerSize = 13;
  const dataSize = data.beatCount * 4;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  view.setUint8(0, data.version);
  view.setFloat32(1, data.bpm, true);
  view.setUint32(5, data.firstBeatSample, true);
  view.setUint32(9, data.beatCount, true);

  for (let i = 0; i < data.beatCount; i++) {
    view.setUint32(headerSize + i * 4, data.anchors[i], true);
  }

  return new Uint8Array(buffer);
}
```

### Database Schema Reference

**Track table updates:**
```sql
-- Fields to update after analysis
UPDATE Track SET
  bpm = ?,           -- Integer BPM (e.g., 128)
  key = ?,           -- Camelot key (e.g., "8A")
  isAnalyzed = 1     -- Mark as analyzed
WHERE id = ?;
```

**PerformanceData insertion:**
```sql
-- Type constants: 1=HotCue, 2=Loop, 3=Beatgrid, 4=Waveform
INSERT INTO PerformanceData (trackId, type, position, data)
VALUES (?, 3, 0, ?);  -- type=3 for Beatgrid, data=beatData blob
```

### Project Structure Notes

New files to create:
```
src/modules/audio/
├── analysis/
│   ├── waveform-analyzer.ts      # (existing) FFT computation
│   ├── track-analyzer.ts         # (new) BPM/Key/Grid detection
│   └── track-analyzer.test.ts    # (new) Unit tests
├── types/
│   └── index.ts                  # (update) Add analysis types
└── constants/
    └── camelot.ts                # (new) Camelot wheel mapping
```

### Previous Story Intelligence

From Story 2.1 (WebGL Waveform Renderer):
- **WaveformAnalyzer pattern:** Follow the same class structure with pre-allocated buffers
- **Serialization format:** Use similar binary format with header + data sections
- **Worker integration:** Use same messaging patterns (REQUEST/PROGRESS/COMPLETE)
- **Testing approach:** Create unit tests for core analysis functions
- **FFT implementation:** Can reuse FFT for onset detection if needed

**Key learnings from 2.1:**
- Use sequence counter pattern for SharedArrayBuffer atomicity if needed
- Handle WebGL context loss gracefully (error boundaries)
- Pre-allocate TypedArrays to avoid GC in analysis hot paths
- Store analysis results in database immediately after computation

### Git Intelligence

Recent commits show:
- `feat(audio):` prefix for audio module changes
- SharedArrayBuffer patterns for real-time data
- DeckUI component integration pattern
- Service layer for track loading (`deck-loader.service.ts`)

### Performance Targets

- **Analysis Speed:** Target <30 seconds for a 5-minute track
- **Memory:** Keep WASM heap under 256MB during analysis
- **Progress Updates:** Send at least 10 updates during analysis for smooth UI
- **Cancellation:** Support aborting analysis within 100ms of request

### Error Handling

```typescript
export type AnalysisError =
  | { type: 'DECODE_FAILED'; message: string }
  | { type: 'ANALYSIS_FAILED'; message: string }
  | { type: 'WASM_INIT_FAILED'; message: string }
  | { type: 'CANCELLED' };
```

### External Dependencies

- **essentia.js:** `npm install essentia.js` - WASM audio analysis
- No other new dependencies required

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture.md#Split-Brain Actor Model]
- [Source: _bmad-output/planning-artifacts/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/implementation-artifacts/2-1-webgl-waveform-renderer.md]
- [Source: src/modules/database/schema/engine-dj-schema.sql]
- [External: essentia.js Documentation](https://mtg.github.io/essentia.js/)
- [External: Camelot Wheel Reference](https://mixedinkey.com/camelot-wheel/)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS
- Unit tests: 53 tests passed (track-analyzer.test.ts: 22 tests)

### Completion Notes List

1. **essentia.js Integration:** Successfully integrated essentia.js WASM library for audio analysis. Added lazy-loading initialization to avoid blocking main thread.

2. **BPM Detection:** Implemented `detectBPM()` using RhythmExtractor2013 algorithm with confidence scoring and BPM range normalization (60-200 BPM).

3. **Key Detection:** Implemented `detectKey()` using KeyExtractor algorithm with Camelot wheel conversion for DJ-friendly notation.

4. **Beatgrid Generation:** Implemented `generateBeatgrid()` using BeatTrackerDegara algorithm. Created compact binary serialization format for database storage.

5. **Database Service:** Created `analysis.service.ts` with methods for storing/retrieving analysis results. Uses transactional updates for Track and PerformanceData tables.

6. **Analysis Store:** Created Zustand store for managing analysis state, progress, and queue. Supports bulk analysis of multiple tracks.

7. **UI Components:** Created `AnalysisProgress.tsx` with inline and full progress indicators. Updated `TrackList.tsx` with Analyze button and progress display.

8. **Event Types:** Added TRACK_ANALYSIS_REQUEST, TRACK_ANALYSIS_PROGRESS, TRACK_ANALYSIS_COMPLETE, TRACK_ANALYSIS_ERROR to messaging.ts.

### Change Log

- 2026-01-16: Implemented Story 2.2 - Automated Track Analysis (BPM/Key/Grid)
  - Added essentia.js WASM library for audio analysis
  - Created TrackAnalyzer with BPM, Key, and Beatgrid detection
  - Implemented Camelot wheel mapping for key notation
  - Created analysis service for database persistence
  - Added analysis store for state management
  - Updated TrackList UI with Analyze button and progress indicators

### File List

**New Files:**
- src/modules/audio/analysis/track-analyzer.ts
- src/modules/audio/analysis/track-analyzer.test.ts
- src/modules/audio/constants/camelot.ts
- src/modules/audio/services/analysis.service.ts
- src/modules/audio/store/analysis.store.ts
- src/modules/audio/components/AnalysisProgress.tsx

**Modified Files:**
- package.json (added essentia.js dependency)
- src/shared/types/messaging.ts (added track analysis event types)
- src/modules/audio/types/index.ts (added analysis types)
- src/modules/audio/services/deck-loader.service.ts (added analysis functions)
- src/modules/audio/index.ts (added exports)
- src/modules/library/components/TrackList.tsx (added Analyze button)
