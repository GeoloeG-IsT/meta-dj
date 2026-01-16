# Story 5.2: Relocate Waveform UI Above Track List

Status: review

## Story

As a user,
I want to see the waveform of the currently loaded track above my track list,
So that I can visualize the playing track while browsing my library.

## Acceptance Criteria

1. **Waveform Placement:** Given the space vacated by the ImportControl panel in LibraryView, when a track is loaded into Deck A, then a waveform component must render in that location (above the track list, below the header).

2. **Synchronized Display:** The waveform must display the currently loaded track's waveform synchronized with playback position from Deck A.

3. **Needle Drop Support:** The waveform must support click-to-seek (Needle Drop) functionality, same as the deck waveform.

4. **Zoom Support:** The waveform must support zoom controls (1x, 2x, 4x, 8x) matching the deck waveform behavior.

5. **Placeholder State:** If no track is loaded in Deck A, the area should display a minimal placeholder state with guidance text.

6. **Track Info Display:** Show minimal track info (title, artist, BPM) alongside the waveform when a track is loaded.

## Tasks / Subtasks

- [x] **Task 1: Create LibraryWaveform Component** (AC: 1, 2, 5)
  - [x] Create new component `src/modules/library/components/LibraryWaveform.tsx`
  - [x] Connect to Deck A state via `useAudioStore(selectDeck('A'))`
  - [x] Render `WaveformOverview` component from audio module
  - [x] Show placeholder when no track loaded ("Load a track in Deck A to preview")
  - [x] Display track title, artist, BPM when track is loaded

- [x] **Task 2: Implement Seek/Interaction** (AC: 3)
  - [x] Wire up `onSeek` callback to `setPosition(deckId, normalizedPosition)`
  - [x] Ensure seek updates both store and playhead position

- [x] **Task 3: Add Zoom Controls** (AC: 4)
  - [x] Add zoom level buttons (1x, 2x, 4x, 8x) styled consistently with existing UI
  - [x] Wire up to `setZoomLevel` from audio store
  - [x] Optionally show WaveformDetail instead of/in addition to WaveformOverview for zoomed view

- [x] **Task 4: Integrate into LibraryView** (AC: 1, 5, 6)
  - [x] Import LibraryWaveform into LibraryView.tsx
  - [x] Place component above the track list section (where ImportControl was removed)
  - [x] Style container with appropriate padding and border matching design system

- [x] **Task 5: Testing** (AC: all)
  - [x] Verify waveform renders when track is loaded in Deck A
  - [x] Verify seek works and updates playhead
  - [x] Verify placeholder displays when no track loaded
  - [x] Verify zoom controls work

## Dev Notes

### Critical Files

**Files to Create:**
```
src/modules/library/components/LibraryWaveform.tsx
```

**Files to Modify:**
```
src/modules/library/LibraryView.tsx  # Add LibraryWaveform component
```

### Component Architecture

```tsx
// LibraryWaveform.tsx
import { WaveformOverview } from '@/modules/audio/components/WaveformOverview';
import { useAudioStore, selectDeck } from '@/modules/audio/store/audio.store';

export function LibraryWaveform() {
  const deck = useAudioStore(selectDeck('A'));
  const setPosition = useAudioStore((s) => s.setPosition);
  const setZoomLevel = useAudioStore((s) => s.setZoomLevel);
  const colorMode = useAudioStore((s) => s.colorMode);

  const handleSeek = (normalizedPosition: number) => {
    setPosition('A', normalizedPosition);
  };

  if (!deck.trackId) {
    return <PlaceholderState />;
  }

  return (
    <div className="...">
      <TrackInfo title={deck.title} artist={deck.artist} bpm={deck.bpm} />
      <WaveformOverview
        waveformData={deck.waveformData}
        playheadPosition={deck.position}
        colorMode={colorMode}
        onSeek={handleSeek}
        isPlaying={deck.isPlaying}
        height={48}
      />
      <ZoomControls zoomLevel={deck.zoomLevel} onChange={(z) => setZoomLevel('A', z)} />
    </div>
  );
}
```

### Integration in LibraryView

```tsx
// LibraryView.tsx
import { LibraryWaveform } from './components/LibraryWaveform';

// In the render:
<div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#000000]">
  {/* NEW: Waveform preview of loaded track */}
  <div className="p-4 border-b border-[#4DFA90]/10">
    <LibraryWaveform />
  </div>

  <section className="flex-1 min-h-0 flex flex-col p-4">
    {/* Track list content */}
  </section>
</div>
```

### Audio Store Selectors

From `audio.store.ts`:
```typescript
// Already available:
export const selectDeck = (deckId: DeckId) => (state: AudioState) => state.decks[deckId];
export const selectColorMode = (state: AudioState) => state.colorMode;

// Store actions needed:
setPosition(deckId, position)
setZoomLevel(deckId, zoomLevel)
```

### Visual Design

**With track loaded:**
```
┌─────────────────────────────────────────────────────┐
│ Title: "Track Name"  Artist: "Artist Name"  120 BPM │
├─────────────────────────────────────────────────────┤
│ ████████████▌░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ <- Waveform
├─────────────────────────────────────────────────────┤
│ [1x] [2x] [4x] [8x]                            Zoom │ <- Optional zoom
└─────────────────────────────────────────────────────┘
```

**Placeholder (no track):**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         Load a track in Deck A to preview           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Dependencies

- `WaveformOverview` from `@/modules/audio/components/WaveformOverview`
- `useAudioStore` from `@/modules/audio/store/audio.store`
- `selectDeck`, `selectColorMode` selectors

### Edge Cases

1. **Track ejected while viewing:** Component should gracefully revert to placeholder
2. **Long track titles:** Truncate with ellipsis
3. **Waveform not yet analyzed:** Show loading state or skeleton
4. **Zoom level persists:** Zoom should persist across track changes (current behavior)

### References

- [Source: src/modules/audio/components/DeckUI.tsx] - Reference for waveform usage
- [Source: src/modules/audio/components/WaveformOverview.tsx] - Component to reuse
- [Source: src/modules/audio/store/audio.store.ts] - State management
- [Source: src/modules/library/LibraryView.tsx] - Integration target

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build verification: `npm run build` completed successfully
- Unit tests: 245 tests passed, no regressions
- TypeScript compilation: No errors in new/modified files

### Completion Notes List

- Created LibraryWaveform component following the architecture spec in Dev Notes
- Component includes three sub-components: PlaceholderState, TrackInfo, and ZoomControls
- Connected to Deck A state via useAudioStore selectors (selectDeck, selectColorMode)
- Implemented needle drop seeking via onSeek callback → setPosition('A', normalizedPosition)
- Zoom controls support 1x, 2x, 4x, 8x levels matching DeckUI behavior
- Integrated into LibraryView.tsx above the track list section with design-consistent styling
- All acceptance criteria satisfied

### File List

**Created:**
- src/modules/library/components/LibraryWaveform.tsx

**Modified:**
- src/modules/library/LibraryView.tsx (added LibraryWaveform import and integration)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status update)

**Deleted:**
- None

### Change Log

- 2026-01-16: Implemented Story 5.2 - LibraryWaveform component with track info display, waveform visualization, seek functionality, and zoom controls. Integrated into LibraryView above track list.
