# Story 5.5: Fix Loop Creation

Status: ready-for-dev

## Story

As a user,
I want loop creation to work correctly when I set loop points,
So that I can create and use loops during performance.

## Acceptance Criteria

1. **Loop In/Out Capture:** Given a track loaded in a deck with the waveform visible, when I set loop in-point and out-point, then the loop region must be captured at the correct sample positions.

2. **Database Persistence:** When I create a loop, the loop data (index, inPoint, outPoint, color, name) must be stored correctly in the `PerformanceData` table of `p.db`.

3. **Visual Rendering:** The created loop must render visually on the waveform with the correct boundaries, color, and active state indicator.

4. **Playback Looping:** When a loop is active and playback reaches the out-point, playback must jump back to the in-point and continue looping until the loop is deactivated.

5. **Persistence Across Reload:** Loops must persist after track reload (loaded from database and displayed on waveform).

6. **Active State Restoration:** When a track is reloaded, previously active loop state should be correctly restored (or gracefully handled).

## Investigation Summary

### What Currently Works

Based on comprehensive codebase analysis:

| Component | Status | Notes |
|-----------|--------|-------|
| Loop Creation UI | ✅ Working | `LoopControls.tsx` - IN/OUT buttons, length presets, toggle |
| Database Storage | ✅ Working | `analysis.service.ts` - saveLoop(), getLoops(), updateLoop() |
| Waveform Rendering | ✅ Working | `LoopRegionOverlay.tsx` - visual brackets and regions |
| State Management | ✅ Working | `audio.store.ts` - addLoop, setActiveLoop, loops array |
| Persistence | ✅ Working | Loops load from database on track load |

### What's Broken: Loop Playback

**ROOT CAUSE:** The audio playback mechanism has NO loop boundary enforcement.

The current playback architecture:
- `StemMixer` (`stem-mixer.service.ts`) handles stem audio playback
- `LibraryWaveform.tsx` has a demo playhead: `const [playheadPosition, setPlayheadPosition] = useState(0);`
- Comment in code: "Local playhead for demo (will be replaced by SAB sync in real implementation)"
- NO code anywhere that checks `activeLoopIndex` during playback
- NO code that constrains playhead position to loop boundaries

**Missing Logic:**
```typescript
// This doesn't exist anywhere in the codebase:
if (activeLoop && currentPosition >= activeLoop.outPoint) {
  seekTo(activeLoop.inPoint);
}
```

### Secondary Issue: isActive State Not Persisted

In `cue-loop.ts` line ~241, `deserializeLoop()` always sets `isActive: false`:
```typescript
return {
  ...parsed,
  isActive: false,  // Always false on load, regardless of previous state
};
```

This means:
- When user creates a loop and sets it active → `isActive: true` in memory
- When track is reloaded → `isActive: false` from database
- User must manually re-activate the loop

## Tasks / Subtasks

- [ ] **Task 1: Implement Loop Playback Logic** (AC: 4)
  - [ ] Identify the playback position update mechanism (StemMixer or main thread)
  - [ ] Add loop boundary check: when `activeLoopIndex >= 0` and position > outPoint, seek to inPoint
  - [ ] Ensure loop check runs in the audio processing loop (every frame/buffer)
  - [ ] Handle edge case: loop created while playing past the out-point
  - [ ] Test: play through loop boundaries, verify it jumps back

- [ ] **Task 2: Verify Loop Data Capture** (AC: 1)
  - [ ] Test `handleSetLoopIn()` in LibraryWaveform - confirm in-point stored at current playhead
  - [ ] Test `handleSetLoopOut()` - confirm out-point stored correctly
  - [ ] Test `handleSetLoopLength()` - confirm loop length calculation uses beatgrid correctly
  - [ ] Verify sample position accuracy (not normalized, not off-by-one)

- [ ] **Task 3: Verify Database Persistence** (AC: 2, 5)
  - [ ] Test `analysisService.saveLoop()` - confirm INSERT/UPDATE to PerformanceData
  - [ ] Verify serialization: JSON structure in BLOB column
  - [ ] Test `analysisService.getLoops()` - confirm loops load on track load
  - [ ] Verify data integrity across save/load cycle

- [ ] **Task 4: Fix Active State Restoration** (AC: 6)
  - [ ] Option A: Persist `isActive` in database (add to serialization)
  - [ ] Option B: Don't persist (current behavior) - document as expected
  - [ ] If Option A: Update `serializeLoop()` and `deserializeLoop()`
  - [ ] If Option A: Update `loadCueLoopDataForDeck()` to restore active loop

- [ ] **Task 5: Testing** (AC: all)
  - [ ] Manual test: Create loop with IN/OUT buttons
  - [ ] Manual test: Create loop with length preset (4 beats)
  - [ ] Manual test: Verify loop renders on waveform
  - [ ] Manual test: Play through loop, verify playback loops
  - [ ] Manual test: Deactivate loop, verify playback continues past out-point
  - [ ] Manual test: Reload track, verify loops persist
  - [ ] Run unit tests: `npm run test:unit`

## Dev Notes

### Critical Architecture Constraints

From `project-context.md` and `architecture.md`:

1. **Split-Brain Isolation:** Audio processing code (`modules/audio/worker`) MUST NOT import React or DOM types. UI code MUST NOT access AudioContext directly.

2. **State Management:** Use Zustand for UI state. If implementing AudioWorklet, use SharedArrayBuffer for high-frequency playback data.

3. **Database Naming:** Use `snake_case` for SQL (PerformanceData table columns).

### Key Files to Modify

**For Loop Playback Logic:**
```
src/modules/audio/services/stem-mixer.service.ts  # If stems handle playback
src/modules/library/components/LibraryWaveform.tsx  # If main thread handles playhead
src/modules/audio/store/audio.store.ts  # For accessing activeLoop state
```

**For Active State Fix (if implementing):**
```
src/modules/audio/types/cue-loop.ts  # serializeLoop/deserializeLoop
src/modules/audio/services/deck-loader.service.ts  # loadCueLoopDataForDeck
```

### Playback Architecture Notes

The current playback mechanism is in transition:
- `usePlayheadSync.ts` defines SharedArrayBuffer infrastructure for AudioWorklet sync (NOT YET IMPLEMENTED)
- `StemMixer` uses AudioBufferSourceNode for stem playback
- Main track playback appears to be demo/placeholder only

**Recommended Approach:**

Since full AudioWorklet playback (Epic 3: The Performer) is in backlog, implement loop logic in the simplest place that works:

1. **Option A (Simplest):** Add loop check to `StemMixer.play()` loop - when position reaches outPoint, restart sources at inPoint position.

2. **Option B:** If there's a `requestAnimationFrame` loop for playhead sync, add loop boundary check there and call seek.

3. **Option C (Future-proof):** Implement basic AudioWorklet with loop logic now (larger scope).

**For this story, Option A or B is recommended** - implement minimal loop enforcement without full AudioWorklet refactor.

### Loop Data Structure

From `cue-loop.ts`:
```typescript
interface LoopData {
  index: number;       // Slot 0-7
  inPoint: number;     // Start sample position
  outPoint: number;    // End sample position
  color: CueColor;     // 8-color palette
  name: string;        // User label
  isActive: boolean;   // Currently looping
}
```

### Store Actions Available

```typescript
// From audio.store.ts
addLoop(deckId, loop)          // Add new loop to deck
removeLoop(deckId, loopIndex)  // Delete loop
setActiveLoop(deckId, index)   // Set active loop (-1 for none)
updateLoop(deckId, index, updates)  // Partial update
setLoops(deckId, loops)        // Replace all loops (on load)
```

### Previous Story Intelligence

**From Story 5.4 (Beatgrid Overlay):**
- Fixed `isAnalyzing` flag not being cleared on success
- Beatgrid data flow: `analysisService` → `deck-loader.service` → `audio.store` → React components
- Same pattern applies to loops

**From Story 5.3 (Debug Panel Removal):**
- All debug logging now via `console.debug()`
- No debug panels in UI

### Database Schema Reference

```sql
-- PerformanceData table (p.db)
CREATE TABLE PerformanceData (
  id INTEGER PRIMARY KEY,
  trackId INTEGER NOT NULL,
  type INTEGER NOT NULL,      -- 2 = LOOP
  position INTEGER,           -- loop slot index (0-7)
  endPosition INTEGER,        -- unused for loops
  color INTEGER,              -- unused, stored in data
  name TEXT,                  -- unused, stored in data
  data BLOB,                  -- JSON: {index, inPoint, outPoint, colorIndex, name}
  FOREIGN KEY (trackId) REFERENCES Track(id)
);

PERFORMANCE_DATA_TYPE.LOOP = 2
```

### Library/Framework Requirements

- **Zustand:** State updates trigger React re-renders via selectors
- **React 19:** Ensure hook dependencies correct in useEffect/useMemo
- **Web Audio API:** `AudioBufferSourceNode.start(when, offset, duration)` for seek-like behavior

### File Structure Notes

```
Loop Data Flow (creation):
LoopControls click → LibraryWaveform.handleSetLoop*()
  → useAudioStore.addLoop() → analysisService.saveLoop() → p.db

Loop Data Flow (playback - TO BE IMPLEMENTED):
audio playback position → check activeLoop → if pos > outPoint → seek(inPoint)
```

### References

- [Source: src/modules/audio/types/cue-loop.ts] - LoopData interface, serialization
- [Source: src/modules/audio/components/LoopControls.tsx] - Loop creation UI
- [Source: src/modules/audio/components/LoopRegionOverlay.tsx] - Waveform rendering
- [Source: src/modules/audio/services/analysis.service.ts#saveLoop] - Database persistence
- [Source: src/modules/audio/services/deck-loader.service.ts#loadCueLoopDataForDeck] - Loop loading
- [Source: src/modules/audio/services/stem-mixer.service.ts] - Audio playback
- [Source: src/modules/library/components/LibraryWaveform.tsx#handleSetLoopIn/Out] - Event handlers
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5] - Original requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

