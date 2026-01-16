# Story 5.4: Fix Beatgrid Overlay on Track Load

Status: ready-for-dev

## Story

As a user,
I want to see the beatgrid overlay appear when I load a track,
So that I can visually confirm beat alignment and prepare for mixing.

## Acceptance Criteria

1. **Beatgrid Renders on Library Load:** Given a track with existing beatgrid analysis data in `p.db`, when I double-click to load the track from the library, then the beatgrid overlay must render on the waveform immediately after load.

2. **Beatgrid Renders on File Picker Load:** Given a track with existing beatgrid analysis data in `p.db`, when I load a track via the "Load" button (file picker), then the beatgrid should render if the track ID can be matched.

3. **Grid Line Alignment:** The grid lines must align with the stored beat anchors from the beatgrid data.

4. **Graceful Fallback:** If no beatgrid data exists for the track, the overlay should not render (no error, just empty).

5. **Error Logging:** Any errors in beatgrid loading must be logged to console for debugging.

6. **Analyzing State Cleared:** After track load completes successfully, the analyzing state must be cleared so the UI returns to normal.

## Tasks / Subtasks

- [ ] **Task 1: Fix analyzing state not being cleared** (AC: 6)
  - [ ] In `loadTrackToDeck`, add `store.setAnalyzing(deckId, false)` at the end of the try block after waveform/transient analysis completes
  - [ ] Verify the "Analyzing waveform..." indicator disappears after successful load

- [ ] **Task 2: Ensure beatgrid loads for file picker tracks** (AC: 2)
  - [ ] Currently `pickAndLoadTrack` only calls `loadTrackToDeck` - it doesn't load beatgrid data
  - [ ] Consider: tracks loaded via file picker don't have a trackId from the library, so beatgrid can't be looked up
  - [ ] This is expected behavior - beatgrid only exists for library tracks
  - [ ] Add a comment explaining this design decision

- [ ] **Task 3: Verify beatgrid data flow for library tracks** (AC: 1, 3)
  - [ ] Confirm `loadBeatgridForDeck` is called after `loadTrackToDeck` in `loadTrackFromLibrary`
  - [ ] Add debug logging to trace beatgrid loading flow
  - [ ] Verify the data reaches `deck.beatgridData` in the store
  - [ ] Verify `WaveformDetail` receives `beatgridData` prop correctly
  - [ ] Verify `BeatgridOverlay` renders when `beatgridData` is present

- [ ] **Task 4: Verify graceful fallback** (AC: 4, 5)
  - [ ] Test with a track that has no beatgrid data
  - [ ] Confirm overlay doesn't render and no errors are thrown
  - [ ] Verify warning logs are present for missing beatgrid

- [ ] **Task 5: Testing** (AC: all)
  - [ ] Manual test: Load a library track with beatgrid - verify overlay appears
  - [ ] Manual test: Load a library track without beatgrid - verify no overlay, no errors
  - [ ] Manual test: Load via file picker - verify waveform works (no beatgrid expected)
  - [ ] Run existing unit tests: `npm run test`
  - [ ] Verify no regressions in waveform rendering

## Dev Notes

### Root Cause Analysis

Based on code review, the primary issue is likely:

**Issue 1: `isAnalyzing` flag never cleared on success**

In `deck-loader.service.ts`:122-144 (`loadTrackToDeck`):
```typescript
store.setAnalyzing(deckId, true);  // Line ~61

try {
  // ... decoding, loading, waveform analysis ...
  store.setTransients(deckId, transients);
  // BUG: Missing store.setAnalyzing(deckId, false) here!
} catch (error) {
  store.setAnalyzing(deckId, false);  // Only on error
  throw error;
}
```

The `isAnalyzing` state stays `true` after successful load, which may affect UI rendering.

**Issue 2: Beatgrid loading happens separately**

The beatgrid is loaded by `loadBeatgridForDeck` which is called AFTER `loadTrackToDeck` completes in `loadTrackFromLibrary`. This is correct but could have timing issues if UI doesn't re-render.

The flow:
1. `loadTrackFromLibrary` → `loadTrackToDeck` (sets waveform)
2. `loadTrackFromLibrary` → `loadBeatgridForDeck` (sets beatgrid)
3. Both update the store, triggering React re-renders

### Critical Files

**Files to Modify:**
```
src/modules/audio/services/deck-loader.service.ts  # Fix analyzing state
```

**Files to Verify (no changes expected):**
```
src/modules/audio/components/BeatgridOverlay.tsx       # Already correct
src/modules/audio/components/WaveformDetail.tsx        # Already correct
src/modules/library/components/LibraryWaveform.tsx     # Already correct
src/modules/audio/store/audio.store.ts                 # Already correct
```

### Architecture Compliance

- **Split-Brain**: Beatgrid data is fetched from database worker via `analysisService.getBeatgrid()`
- **State Management**: Store updates trigger React re-renders via Zustand selectors
- **Error Handling**: Warnings logged to console, no UI crashes on missing data

### Library/Framework Requirements

- **Zustand**: State updates are synchronous and should trigger immediate re-renders
- **React 19**: Ensure proper hook dependencies in useEffect/useMemo

### File Structure Notes

- Beatgrid overlay rendering path: `LibraryWaveform` → `WaveformDetail` → `BeatgridOverlay`
- Beatgrid data path: `analysisService` → `deck-loader.service` → `audio.store` → React components

### Previous Story Intelligence

**From Story 5.3:**
- Removed debug panels, redirected logs to console
- App.tsx simplified - all logging now via console.debug()

**From Story 5.2:**
- LibraryWaveform now contains the full deck functionality
- Waveform is rendered above track list in LibraryView
- Hot cues and loops already render correctly on the waveform

### References

- [Source: src/modules/audio/services/deck-loader.service.ts#loadTrackToDeck] - Missing setAnalyzing(false)
- [Source: src/modules/audio/services/deck-loader.service.ts#loadBeatgridForDeck] - Beatgrid loading logic
- [Source: src/modules/audio/services/deck-loader.service.ts#loadTrackFromLibrary] - Full loading flow
- [Source: src/modules/audio/components/WaveformDetail.tsx#448-457] - BeatgridOverlay conditional render
- [Source: src/modules/audio/components/BeatgridOverlay.tsx] - Overlay component implementation
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4] - Original requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
