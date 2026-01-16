# Story 5.6: Implement 8-Loop System (Hot Loops + Saved Loops)

Status: ready-for-dev

## Story

As a user,
I want to have 8 loop slots similar to hot cues, with the ability to toggle between hot loop and saved loop modes,
So that I can prepare multiple loop points and choose my preferred workflow.

## Acceptance Criteria

1. **Loop Pad UI:** The UI must display 8 loop slots (Loop 1-8) in a grid layout similar to the hot cue pad layout (`PerformancePads.tsx`).

2. **Hot Loop Mode:** When in Hot Loop mode, pressing a pad must:
   - Create a loop at the current playhead position with default length (e.g., 4 beats)
   - Immediately activate the loop (playback loops)
   - Releasing the pad must deactivate the loop (playback continues past out-point)

3. **Saved Loop Mode:** When in Saved Loop mode, clicking a pad must:
   - If the slot has a saved loop: Jump playhead to the loop's inPoint and activate the loop
   - If the slot is empty: Create and save a loop at current position (like hot cue set behavior)

4. **Mode Toggle:** A toggle control must allow switching between Hot Loop and Saved Loop mode. The current mode should be visually indicated.

5. **Loop Persistence:** Saved loops must persist in `p.db` (PerformanceData table) with position, length, color, and optional name. (Already implemented in Story 5.5)

6. **MIDI Support:** Loop slots must be triggerable via MIDI (mapped to pads/buttons). This is a design consideration for future Epic 4 integration.

7. **Visual Feedback:** Active loops must be visually indicated on both:
   - The loop pads (glow, border, color change)
   - The waveform overlay (existing `LoopRegionOverlay.tsx`)

## Tasks / Subtasks

- [ ] **Task 1: Create LoopPads Component** (AC: 1, 7)
  - [ ] Create `src/modules/audio/components/LoopPads.tsx`
  - [ ] Model after `PerformancePads.tsx` structure (8 pads in grid)
  - [ ] Accept `loops: LoopData[]` and `activeLoopIndex: number` props
  - [ ] Display loop number (1-8), color, and name if set
  - [ ] Show empty state for unassigned slots (dashed border)
  - [ ] Add visual indication for active loop (glow, highlight)
  - [ ] Add keyboard shortcuts (Alt+1 through Alt+8 to avoid conflict with cue shortcuts)

- [ ] **Task 2: Add Loop Mode State** (AC: 4)
  - [ ] Add `loopMode: 'hot' | 'saved'` to audio store deck state
  - [ ] Add `setLoopMode(deckId, mode)` action
  - [ ] Default mode: 'saved' (matches most DJ software behavior)

- [ ] **Task 3: Implement Saved Loop Mode Behavior** (AC: 3, 5)
  - [ ] On pad click (saved mode, slot has loop):
    - Seek StemMixer to loop.inPoint (convert samples to seconds)
    - Call `setActiveLoop(deckId, loopIndex)` to activate
    - Update StemMixer via `setLoop(boundary)`
  - [ ] On pad click (saved mode, slot empty):
    - Create loop at current position with default 4-beat length
    - Save to database via `analysisService.saveLoop()`
    - Add to store via `addLoop()`
  - [ ] On right-click: Show context menu for edit/delete (reuse CueContextMenu pattern)

- [ ] **Task 4: Implement Hot Loop Mode Behavior** (AC: 2)
  - [ ] On pad mousedown/touchstart (hot mode):
    - Calculate loop boundaries: inPoint = current position, outPoint = inPoint + (4 beats * samplesPerBeat)
    - Activate loop immediately via `setActiveLoop()` and `StemMixer.setLoop()`
    - Store temporary loop (not persisted until user explicitly saves)
  - [ ] On pad mouseup/touchend (hot mode):
    - Deactivate loop via `setActiveLoop(deckId, -1)` and `StemMixer.setLoop(null)`
    - Do NOT delete the loop data (user can convert to saved loop later)
  - [ ] Add press-and-hold visual feedback (pad stays highlighted while pressed)

- [ ] **Task 5: Create Mode Toggle Component** (AC: 4)
  - [ ] Create toggle switch or segmented control: [HOT] [SAVED]
  - [ ] Display in LoopControls area or above LoopPads
  - [ ] Visual indication of current mode
  - [ ] Keyboard shortcut: Shift+L to toggle mode

- [ ] **Task 6: Integrate with LibraryWaveform** (AC: 7)
  - [ ] Pass LoopPads callbacks through LibraryWaveform
  - [ ] Ensure waveform LoopRegionOverlay updates when loops change
  - [ ] Verify active loop indicator syncs between pads and waveform

- [ ] **Task 7: Testing** (AC: all)
  - [ ] Unit tests for LoopPads component
  - [ ] Unit tests for mode toggle state
  - [ ] Manual test: Switch modes, verify behavior changes
  - [ ] Manual test: Hot loop - press and hold, release
  - [ ] Manual test: Saved loop - click to jump and activate
  - [ ] Manual test: Create loops in both modes
  - [ ] Manual test: Verify persistence across track reload
  - [ ] Run `npm run test:unit`

## Dev Notes

### Critical Architecture Constraints

From `project-context.md`:

1. **Split-Brain Isolation:** UI code in `modules/audio/components` MUST NOT access `AudioContext` directly. Use `StemMixer` service for audio control.

2. **State Management:** Use Zustand for UI state (`audio.store.ts`). Loop boundary enforcement is already in `StemMixer.setLoop()`.

3. **Zero Allocations in Render Loop:** LoopPads should use `useMemo` and `useCallback` to prevent unnecessary re-renders during playback.

### Existing Infrastructure to Leverage

**From Story 5.5 (Fix Loop Creation):**

| Component | Location | Purpose |
|-----------|----------|---------|
| `StemMixer.setLoop(boundary)` | `stem-mixer.service.ts` | Set active loop boundaries for playback |
| `StemMixer.setLoop(null)` | `stem-mixer.service.ts` | Clear active loop |
| `loopBoundaryFromSamples()` | `stem-mixer.service.ts` | Convert sample positions to seconds |
| `analysisService.saveLoop()` | `analysis.service.ts` | Persist loop to p.db |
| `analysisService.getLoops()` | `analysis.service.ts` | Load loops from p.db |
| `LoopRegionOverlay` | `LoopRegionOverlay.tsx` | Waveform loop visualization |
| `setActiveLoop()` | `audio.store.ts` | Store action to set active loop index |

**From PerformancePads (Hot Cue Pattern):**

```typescript
// Key patterns to replicate:
- 8-pad grid layout with consistent sizing
- Keyboard shortcut handling (global listener)
- Right-click context menu support
- Color-coded visual feedback
- Empty vs set state styling
```

### Key Files to Modify

**New Files:**
```
src/modules/audio/components/LoopPads.tsx         # New 8-loop pad component
src/modules/audio/components/LoopModeToggle.tsx   # Optional: separate toggle component
```

**Modified Files:**
```
src/modules/audio/store/audio.store.ts            # Add loopMode state
src/modules/library/components/LibraryWaveform.tsx # Integrate LoopPads
```

### State Shape Changes

```typescript
// In audio.store.ts DeckState:
interface DeckState {
  // ... existing fields ...
  loops: LoopData[];
  activeLoopIndex: number;
  loopMode: 'hot' | 'saved';  // NEW: Add this field
}

// New action:
setLoopMode: (deckId: DeckId, mode: 'hot' | 'saved') => void;
```

### Hot Loop vs Saved Loop Behavior Matrix

| Action | Hot Loop Mode | Saved Loop Mode |
|--------|---------------|-----------------|
| Click empty slot | Create temp loop, activate on press | Create & save loop, activate |
| Click filled slot | Activate loop on press | Jump to loop, activate |
| Release pad | Deactivate loop | No action (stays active) |
| Right-click | Context menu | Context menu |
| Deactivate | Release pad | Click ACTIVE button or press L |

### Sample Position Calculations

From existing code in `LibraryWaveform.tsx`:

```typescript
// Calculate samples per beat
const samplesPerBeat = (60 / bpm) * sampleRate;

// Default 4-beat loop
const loopLengthSamples = samplesPerBeat * 4;

// Create loop at position
const loop: LoopData = {
  index: slotIndex,
  inPoint: Math.round(currentPositionSamples),
  outPoint: Math.round(currentPositionSamples + loopLengthSamples),
  color: DEFAULT_CUE_COLOR,
  name: '',
  isActive: true,
};
```

### Converting Sample Position to Seconds for StemMixer

From `stem-mixer.service.ts`:

```typescript
// Use the utility function
import { loopBoundaryFromSamples } from '../services/stem-mixer.service';

const boundary = loopBoundaryFromSamples(loop.inPoint, loop.outPoint, sampleRate);
stemMixer.setLoop(boundary);
```

### Keyboard Shortcuts

To avoid conflicts with existing shortcuts:
- Hot Cues: 1-8 (unmodified)
- Loop Pads: Alt+1 through Alt+8
- Loop Toggle: L (existing)
- Mode Switch: Shift+L (new)

### Previous Story Intelligence

**From Story 5.5:**
- Loop playback boundary enforcement works via `StemMixer` polling at 10ms intervals
- `isActive` is a runtime state, NOT persisted to database (correct behavior)
- Sample positions must be integers (use `Math.round`)
- Database uses JSON serialization in BLOB column

**From Story 5.4:**
- Data flow pattern: service → store → React component
- Use selectors for efficient re-renders

### Project Structure Notes

```
Loop Data Flow (hot loop creation):
LoopPads mousedown → calculate boundaries → setActiveLoop() + StemMixer.setLoop()
LoopPads mouseup → setActiveLoop(-1) + StemMixer.setLoop(null)

Loop Data Flow (saved loop creation):
LoopPads click (empty) → create loop → addLoop() + saveLoop() → setActiveLoop()

Loop Data Flow (saved loop trigger):
LoopPads click (filled) → StemMixer.seek(inPoint) → setActiveLoop() + StemMixer.setLoop()
```

### References

- [Source: src/modules/audio/components/PerformancePads.tsx] - Hot cue pad pattern to replicate
- [Source: src/modules/audio/components/LoopControls.tsx] - Existing loop controls
- [Source: src/modules/audio/components/LoopRegionOverlay.tsx] - Waveform loop rendering
- [Source: src/modules/audio/types/cue-loop.ts] - LoopData interface, color constants
- [Source: src/modules/audio/store/audio.store.ts] - Loop state management
- [Source: src/modules/audio/services/stem-mixer.service.ts] - Loop playback enforcement
- [Source: src/modules/audio/services/analysis.service.ts#saveLoop] - Database persistence
- [Source: src/modules/library/components/LibraryWaveform.tsx] - Integration point
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6] - Original requirements
- [Source: _bmad-output/implementation-artifacts/5-5-fix-loop-creation.md] - Previous story learnings

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
