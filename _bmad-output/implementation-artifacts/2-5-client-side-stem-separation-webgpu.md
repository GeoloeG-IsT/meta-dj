# Story 2.5: Client-Side Stem Separation (WebGPU)

Status: ready-for-dev

## Story

As a user,
I want to isolate or mute vocals, drums, bass, and other instruments from a track,
So that I can create live remixes and mashups without specialized source files.

## Acceptance Criteria

1. **WebGPU Detection:** Given a browser that supports WebGPU, when the application initializes, then the system must detect WebGPU availability and enable the stems feature. If WebGPU is unavailable, display a clear message "Stems require WebGPU" and disable the feature (no WASM fallback per architecture decision). [Source: architecture.md#AI & Compute Strategy]

2. **ONNX Session Initialization:** Given a track and WebGPU support, when I trigger "Analyze Stems", then the system must initialize an `ONNX Runtime Web` session using the WebGPU execution provider. The model must be loaded asynchronously with progress indication. [Source: epics.md#Story 2.5]

3. **Demucs Model Inference:** Given the ONNX session is ready, when stem analysis runs, then the system must process the audio through a Demucs-compatible model (htdemucs or similar ONNX-converted model) and generate 4 distinct audio buffers: Vocals, Drums, Bass, Other. [Source: epics.md#Story 2.5]

4. **Stem Storage:** Given successful stem separation, when the analysis completes, then the system must store the stem audio buffers in memory (IndexedDB cache for persistence across sessions) associated with the track ID. Show "Stems Ready" indicator on track. [Source: epics.md#Story 2.5]

5. **Mute/Solo UI Controls:** Given stems are available for a track, when the track is loaded into a deck, then the UI must provide toggle buttons to mute/solo each stem (Vocals, Drums, Bass, Other) independently. Visual state must clearly indicate active/muted stems. [Source: epics.md#Story 2.5]

6. **Real-Time Playback Integration:** Given stem toggles are active, when I toggle a stem during playback, then the audio output must reflect the change within <50ms latency. Stems should be mixed in real-time without re-processing. [Source: epics.md#Story 2.5]

7. **Progress Indication:** Given stem analysis is running, when processing, then the UI must show a progress bar with percentage and estimated status (not time). Allow cancellation of in-progress analysis. [Source: ux-design-specification.md#Visual Feedback]

8. **Worker Isolation:** All ONNX inference must run in a dedicated Web Worker to prevent blocking the main thread or audio worklet. Communication via kernel message bus. [Source: architecture.md#Split-Brain Actor Model]

## Tasks / Subtasks

- [x] **Task 1: WebGPU Detection & Feature Gating** (AC: 1)
  - [x] Create `src/modules/audio/services/webgpu-detector.ts` to check `navigator.gpu` availability
  - [x] Add `hasWebGPU` flag to application state (Zustand store)
  - [x] Create `StemsUnavailable.tsx` placeholder component when WebGPU not supported
  - [x] Add feature flag check before showing stem UI controls
  - [x] Write unit tests for detection logic

- [x] **Task 2: ONNX Runtime Web Setup** (AC: 2, 8)
  - [x] Add `onnxruntime-web` package to dependencies
  - [x] Create `src/modules/audio/workers/stems.worker.ts` dedicated stem worker
  - [x] Implement ONNX session initialization with WebGPU backend
  - [x] Add model loading with progress reporting via postMessage
  - [x] Handle initialization errors gracefully with user feedback
  - [x] Register worker with kernel message bus (new EventTypes: STEMS_*)

- [x] **Task 3: Demucs Model Integration** (AC: 3)
  - [x] Research and select ONNX-compatible Demucs model (htdemucs_ft recommended)
  - [x] Create model download/caching mechanism (store in OPFS or IndexedDB)
  - [x] Implement audio preprocessing: convert AudioBuffer to model input tensor format
  - [x] Implement inference pipeline with chunked processing for long tracks
  - [x] Implement output post-processing: convert model output to 4 separate AudioBuffers
  - [x] Add progress reporting during inference (per-chunk updates)

- [x] **Task 4: Stem Storage & Caching** (AC: 4)
  - [x] Create `src/modules/audio/services/stems-cache.service.ts` for stem persistence
  - [x] Store stems in IndexedDB keyed by track ID + hash
  - [x] Add `hasStemData` flag to track metadata (check on track load)
  - [x] Implement stem retrieval on track load (skip analysis if cached)
  - [x] Add cache invalidation when track file changes
  - [x] Add "Clear Stems" action in track context menu

- [x] **Task 5: Stem State Management** (AC: 5, 6)
  - [x] Add stem state to `DeckState` in `audio.store.ts`:
    ```typescript
    stems: {
      available: boolean;
      analyzing: boolean;
      progress: number;
      buffers: { vocals: AudioBuffer | null; drums: AudioBuffer | null; bass: AudioBuffer | null; other: AudioBuffer | null };
      muted: { vocals: boolean; drums: boolean; bass: boolean; other: boolean };
      solo: { vocals: boolean; drums: boolean; bass: boolean; other: boolean };
    }
    ```
  - [x] Add actions: `setStemBuffers`, `toggleStemMute`, `toggleStemSolo`, `setStemProgress`, `clearStems`
  - [x] Implement solo logic: when one stem is soloed, others are effectively muted
  - [x] Load stem data in `deck-loader.service.ts` if available

- [ ] **Task 6: Stem Controls UI Component** (AC: 5, 7)
  - [ ] Create `src/modules/audio/components/StemControls.tsx`
  - [ ] 4 stem buttons with icons (Mic=Vocals, Drum=Drums, Bass=Bass, Music=Other)
  - [ ] Visual states: active (normal), muted (dimmed), solo (highlighted + "S" badge)
  - [ ] Click = toggle mute, Shift+Click = toggle solo
  - [ ] "Analyze Stems" button when stems not available
  - [ ] Progress bar during analysis with cancel button
  - [ ] Integrate with DeckUI component
  - [ ] Apply Engine DJ color scheme (stem-specific colors from UX spec)

- [ ] **Task 7: Audio Mixing for Stems** (AC: 6)
  - [ ] Create `src/modules/audio/services/stem-mixer.service.ts`
  - [ ] Implement real-time stem mixing using Web Audio API GainNodes
  - [ ] Create 4 source nodes (one per stem) → 4 gain nodes → merger → output
  - [ ] Mute = set gain to 0, Solo = set other gains to 0
  - [ ] Ensure sample-accurate synchronization across stem buffers
  - [ ] Handle dynamic stem toggle without audio glitches (use ramp)

- [ ] **Task 8: Integration & Testing** (AC: all)
  - [ ] Add unit tests for WebGPU detection
  - [ ] Add unit tests for stem state management
  - [ ] Add unit tests for mute/solo logic
  - [ ] Add integration test for stem analysis workflow
  - [ ] Test progress reporting accuracy
  - [ ] Test cancel functionality during analysis
  - [ ] Verify memory cleanup when track unloads

## Dev Notes

### Critical Architecture Compliance

**WebGPU Enforcement (MANDATORY):**
- NO WASM/CPU fallback for stem separation per architecture decision
- If WebGPU unavailable, feature is disabled entirely with clear messaging
- Rationale: "CPU/WASM fallback for real-time stem separation provides unacceptable latency/quality"

**Split-Brain Pattern (MANDATORY):**
- ONNX inference MUST run in dedicated `stems.worker.ts` (NOT on main thread)
- Audio mixing runs in AudioWorklet for real-time performance
- UI shows progress via Zustand store updates from worker messages

**Thread Boundaries:**
```
[User Click "Analyze Stems"]
    --> [Main Thread]
    --> [Kernel Message Bus: STEMS_ANALYZE_REQUEST]
    --> [Stems Worker: ONNX Inference]
    --> [Progress Updates: STEMS_PROGRESS]
    --> [Complete: STEMS_READY + AudioBuffer data]
    --> [Store Update]
    --> [UI Re-render]

[Playback with Stems]
    --> [Stem Buffers loaded to Audio Context]
    --> [GainNodes control mute/solo]
    --> [Toggle via store action -> gain.setValueAtTime()]
```

### Previous Story Intelligence

**From Story 2.4 (Hot Cue & Loop Management):**
- Optimistic update pattern for UI responsiveness
- Toast notifications for success/error feedback (`toast.show()`)
- Context menu pattern for additional actions
- Keyboard shortcut handling with `event.stopPropagation()`

**From Story 2.3 (Beatgrid Editing):**
- Progress indication patterns during long operations
- CSS animations in `src/index.css` for performance
- Accessibility: `role="img"` and `aria-label` on status indicators

**From Story 2.2 (Track Analysis):**
- `analysisService` pattern for database operations
- PERFORMANCE_DATA_TYPE constants (will need new type for stems?)
- Worker-based heavy computation pattern (essentia.js runs in worker)
- Progress reporting via message passing

**From Story 2.1 (Waveform Renderer):**
- WebGL rendering patterns (may need stem-aware waveform coloring later)
- `usePlayheadSync` for synchronized updates

### Git Intelligence (Recent Commits)

Recent patterns from cue/loop implementation:
```
feat(loop-management): update LoopControls and DeckUI for loop context menu
feat(cue-loop): implement state management for hot cues and loops
```
Follow same prefix patterns: `feat(stems):` for stem-related commits.

### Package Dependencies Required

```bash
npm install onnxruntime-web
```

**Note:** `onnxruntime-web` bundles are large (~15-20MB for WebGPU backend). Consider:
- Lazy loading the ONNX runtime only when stems feature is used
- Storing model files separately in public/ or fetching from CDN
- Code splitting to avoid bloating initial bundle

### Model Selection & Preparation

**Recommended: htdemucs_ft (Fine-tuned Hybrid Transformer Demucs)**
- Best quality for music separation
- Need to convert PyTorch model to ONNX format
- Expected model size: ~80-100MB

**ONNX Conversion (Pre-requisite research task):**
```python
# This is a reference - actual conversion may need adjustments
import torch
import onnx
from demucs import pretrained

model = pretrained.get_model('htdemucs_ft')
dummy_input = torch.randn(1, 2, 44100 * 10)  # 10 seconds stereo
torch.onnx.export(model, dummy_input, "htdemucs_ft.onnx",
                  opset_version=17,
                  input_names=['audio'],
                  output_names=['vocals', 'drums', 'bass', 'other'])
```

**Alternative: Use pre-converted models from Hugging Face or similar sources**

### Data Structures

```typescript
// Stem types
export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemBuffers {
  vocals: AudioBuffer | null;
  drums: AudioBuffer | null;
  bass: AudioBuffer | null;
  other: AudioBuffer | null;
}

export interface StemState {
  available: boolean;      // Stems have been analyzed
  analyzing: boolean;      // Analysis in progress
  progress: number;        // 0-100 progress percentage
  buffers: StemBuffers;    // Actual audio data
  muted: Record<StemType, boolean>;
  solo: Record<StemType, boolean>;  // Only one can be soloed at a time
}

// Worker message types
export enum StemEventType {
  STEMS_ANALYZE_REQUEST = 'STEMS_ANALYZE_REQUEST',
  STEMS_ANALYZE_PROGRESS = 'STEMS_ANALYZE_PROGRESS',
  STEMS_ANALYZE_COMPLETE = 'STEMS_ANALYZE_COMPLETE',
  STEMS_ANALYZE_ERROR = 'STEMS_ANALYZE_ERROR',
  STEMS_ANALYZE_CANCEL = 'STEMS_ANALYZE_CANCEL',
}

export interface StemAnalyzeRequest {
  trackId: number;
  audioData: ArrayBuffer;  // Raw audio for processing
  sampleRate: number;
}

export interface StemAnalyzeProgress {
  trackId: number;
  progress: number;  // 0-100
  stage: 'loading_model' | 'preprocessing' | 'inference' | 'postprocessing';
}

export interface StemAnalyzeComplete {
  trackId: number;
  stems: {
    vocals: ArrayBuffer;
    drums: ArrayBuffer;
    bass: ArrayBuffer;
    other: ArrayBuffer;
  };
}
```

### Visual Design Requirements

**Stem Control Button Design:**
```
┌─────────────────────────────────────────┐
│  [🎤]  [🥁]  [🎸]  [🎹]  [Analyze]    │
│  VOX   DRM   BAS   OTH                  │
└─────────────────────────────────────────┘

States:
- Normal: Button with stem icon, label below
- Muted: Dimmed (opacity 0.4), strikethrough label
- Solo: Highlighted border (Engine Green), "S" badge top-right
- Analyzing: Pulsing animation, progress bar below
```

**Color Coding (per UX spec):**
- Vocals: Cyan (#5AC8FA)
- Drums: Orange (#FF9500)
- Bass: Purple (#AF52DE)
- Other: Green (#4DFA90 - Engine Green)

### Keyboard Shortcuts

```typescript
const STEM_SHORTCUTS = {
  'v': 'vocals',  // Toggle vocals mute
  'd': 'drums',   // Toggle drums mute
  'b': 'bass',    // Toggle bass mute
  'o': 'other',   // Toggle other mute
  // Shift + key = solo
};

// Only active when deck is focused and stems are available
```

### Performance Targets

- **Model load time:** <5s on modern hardware (show loading indicator)
- **Analysis time:** Proportional to track length (~2-3x realtime on M1/RTX GPU)
- **Toggle latency:** <50ms from click to audio change
- **Memory usage:** ~500MB peak during analysis (warn user)
- **Stem playback:** Zero additional latency compared to normal playback

### Error Handling

```typescript
export type StemError =
  | { type: 'WEBGPU_UNAVAILABLE'; message: string }
  | { type: 'MODEL_LOAD_FAILED'; message: string }
  | { type: 'INFERENCE_FAILED'; message: string }
  | { type: 'OUT_OF_MEMORY'; message: string }
  | { type: 'CANCELLED'; message: string };
```

- **WebGPU unavailable:** Disable feature, show info message
- **Model load failed:** Retry with exponential backoff, offer manual retry
- **Inference failed:** Log error, show toast, allow retry
- **Out of memory:** Suggest closing other tabs, offer to analyze shorter segment
- **Cancelled:** Clean up resources, reset progress state

### Memory Management

```typescript
// Critical: Clean up stem buffers when:
// 1. Track is unloaded from deck
// 2. New track is loaded
// 3. User manually clears stems
// 4. Analysis is cancelled

const cleanupStems = (deckId: 'A' | 'B') => {
  const state = useAudioStore.getState();
  const deck = state.decks[deckId];

  // Disconnect audio nodes
  deck.stems.buffers.vocals = null;
  deck.stems.buffers.drums = null;
  deck.stems.buffers.bass = null;
  deck.stems.buffers.other = null;

  // Force garbage collection hint (not guaranteed)
  if (globalThis.gc) globalThis.gc();
};
```

### Project Structure Notes

**Files to Create:**
```
src/modules/audio/
├── workers/
│   └── stems.worker.ts          # ONNX inference worker
├── services/
│   ├── webgpu-detector.ts       # WebGPU availability check
│   ├── stems-cache.service.ts   # IndexedDB stem storage
│   └── stem-mixer.service.ts    # Real-time audio mixing
├── components/
│   ├── StemControls.tsx         # Mute/solo UI
│   └── StemsUnavailable.tsx     # Fallback when no WebGPU
└── types/
    └── stems.ts                 # Type definitions
```

**Files to Modify:**
```
src/modules/audio/store/audio.store.ts     # Add stem state to DeckState
src/modules/audio/components/DeckUI.tsx    # Integrate StemControls
src/modules/audio/services/deck-loader.service.ts  # Load cached stems
src/shared/types/messaging.ts              # Add STEMS_* event types
package.json                               # Add onnxruntime-web
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: _bmad-output/planning-artifacts/architecture.md#AI & Compute Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Split-Brain Actor Model]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Feedback]
- [Source: _bmad-output/planning-artifacts/project-context.md#Technology Stack]
- [Source: _bmad-output/implementation-artifacts/2-4-hot-cue-loop-management.md]
- [Source: _bmad-output/implementation-artifacts/2-2-automated-track-analysis-bpm-key-grid.md]
- [Source: src/modules/audio/services/analysis.service.ts]
- [ONNX Runtime Web Documentation: https://onnxruntime.ai/docs/get-started/with-javascript.html]
- [Demucs Model: https://github.com/facebookresearch/demucs]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
