# Story 2.4: Hot Cue & Loop Management

Status: ready-for-dev

## Story

As a user,
I want to set, color-code, and name Hot Cues and Loops on the waveform,
So that I can mark specific performance sections and trigger them during a set.

## Acceptance Criteria

1. **Cue Point Creation:** Given a loaded track in the deck, when I press a performance pad (UI button or keyboard shortcut), then the system must record the current sample position and add a `quickCue` entry in the `p.db` database. [Source: epics.md#Story 2.4]

2. **Loop Creation:** Given a loaded track, when I activate loop mode and set loop boundaries, then the system must record both in-point and out-point sample positions and add a `loop` entry in the `p.db` database with calculated loop length. [Source: epics.md#Story 2.4]

3. **Waveform Visualization:** The system must visually render cue/loop markers on the WebGL waveform at the exact sample position with distinct visual styles (cue = triangle marker, loop = bracketed region). [Source: epics.md#Story 2.4]

4. **Color Selection:** The system must support color selection for each cue via a custom context menu using the Engine DJ standard 8-color palette. [Source: epics.md#Story 2.4, ux-design-specification.md#Context Menus]

5. **Naming Support:** The system must support renaming each cue/loop via a custom context menu with inline editing. [Source: epics.md#Story 2.4]

6. **Instant Persistence:** Changes must be reflected instantly in the UI (optimistic update) and persisted to the SQLite database asynchronously. Show "Saved" toast on successful write. [Source: epics.md#Story 2.4, ux-design-specification.md#Optimistic State Updates]

7. **Keyboard Shortcuts:** Support keyboard shortcuts for cue points (1-8 keys for pads 1-8) and loop activation (L key). [Source: ux-design-specification.md#Keyboard is King]

8. **Delete Support:** Support deleting cues/loops via context menu with confirmation. [Source: ux-design-specification.md#Hold-to-Confirm]

## Tasks / Subtasks

- [x] **Task 1: Database Schema & Service Layer** (AC: 1, 2, 6)
  - [x] Define `HotCueData` and `LoopData` TypeScript interfaces matching Engine DJ schema
  - [x] Add `saveCuePoint()` method to analysis.service.ts for PerformanceData type=1
  - [x] Add `saveLoop()` method to analysis.service.ts for PerformanceData type=2
  - [x] Add `getCuePoints()` and `getLoops()` methods to retrieve stored data
  - [x] Add `deleteCuePoint()` and `deleteLoop()` methods
  - [x] Add `updateCuePoint()` and `updateLoop()` for color/name changes
  - [x] Write unit tests for serialization/deserialization

- [x] **Task 2: Store State Management** (AC: 1, 2, 6)
  - [x] Add `cuePoints: HotCueData[]` and `loops: LoopData[]` to DeckState in audio.store.ts
  - [x] Add actions: `setCuePoints`, `setLoops`, `addCuePoint`, `addLoop`, `updateCuePoint`, `updateLoop`, `removeCuePoint`, `removeLoop`
  - [x] Load cue/loop data in deck-loader.service.ts when track loads
  - [x] Implement optimistic update pattern with rollback on failure

- [x] **Task 3: Cue Marker Overlay Component** (AC: 3)
  - [x] Create `CueMarkerOverlay.tsx` component for rendering cue markers
  - [x] Render triangle markers at cue positions with pad number (1-8)
  - [x] Apply color from cue data (default: Engine Green)
  - [x] Calculate pixel positions based on view range (same pattern as BeatgridOverlay)
  - [x] Integrate with WaveformDetail component
  - [x] Write unit tests for position calculations

- [x] **Task 4: Loop Region Overlay Component** (AC: 3)
  - [x] Create `LoopRegionOverlay.tsx` component for rendering loop regions
  - [x] Render bracketed region from in-point to out-point
  - [x] Show loop length label (e.g., "4 bars", "1/2 beat")
  - [x] Apply semi-transparent fill with border
  - [x] Integrate with WaveformDetail component
  - [x] Write unit tests for region calculations

- [x] **Task 5: Performance Pad UI** (AC: 1, 7)
  - [x] Create `PerformancePads.tsx` component with 8 pad buttons
  - [x] Display pad number and assigned cue name/color
  - [x] Handle click to set/trigger cue point
  - [x] Show "empty" state for unassigned pads
  - [x] Integrate with DeckUI component
  - [x] Add keyboard event listeners for keys 1-8

- [ ] **Task 6: Loop Controls UI** (AC: 2, 7)
  - [ ] Create `LoopControls.tsx` component with loop in/out/active buttons
  - [ ] Display current loop length selector (1/4, 1/2, 1, 2, 4, 8, 16 beats)
  - [ ] Handle loop activation/deactivation toggle
  - [ ] Visual feedback for active loop state (Engine Green highlight)
  - [ ] Add keyboard event listener for L key
  - [ ] Integrate with DeckUI component

- [ ] **Task 7: Context Menu for Cue/Loop Management** (AC: 4, 5, 8)
  - [ ] Create `CueContextMenu.tsx` using Headless UI Popover
  - [ ] Add color picker with 8-color Engine DJ palette
  - [ ] Add inline name editor with blur-to-save
  - [ ] Add delete option with hold-to-confirm pattern
  - [ ] Trigger on right-click on cue marker or pad button
  - [ ] Wire up to store actions for persistence

- [ ] **Task 8: Integration & Testing** (AC: all)
  - [ ] Add unit tests for cue/loop position calculations
  - [ ] Add unit tests for keyboard shortcut handlers
  - [ ] Test database persistence across page reload
  - [ ] Verify optimistic update and rollback behavior
  - [ ] Test context menu interactions

## Dev Notes

### Critical Architecture Compliance

**Split-Brain Pattern (MANDATORY):**
- Cue/loop UI rendering runs on main thread (low-frequency UI operation)
- Database writes MUST go through the kernel message bus to the database worker
- Use optimistic updates: update store immediately, persist async, rollback on failure

**Thread Boundaries:**
```
[User Click Pad] --set cue--> [Main Thread Store] --optimistic update--> [UI Render]
                                    |
                                    v
[Kernel Message Bus] --CUE_POINT_SAVE--> [Database Worker] --persist--> [OPFS]
                                                |
                                                v
                         [Confirm/Error] --callback--> [Show Toast / Rollback]
```

### Previous Story Intelligence

**From Story 2.3 (Beatgrid Editing):**
- `BeatgridOverlay.tsx` pattern can be adapted for cue/loop overlays
- `getVisibleBeats()` utility pattern for calculating visible markers in view range
- Toast notification system already exists (`toast.show()`)
- Database persistence via `analysisService` methods
- Optimistic update with rollback pattern established in `handleSlipCommit`

**Key learnings from 2.3 code review:**
- CSS animations moved to `src/index.css` for performance
- Toast needs `role="img"` and `aria-label` for accessibility
- Always reset state on track change (useEffect cleanup)
- Add `event.stopPropagation()` to keyboard handlers

**From Story 2.2 (Track Analysis):**
- `PERFORMANCE_DATA_TYPE` constants already defined: HOT_CUE=1, LOOP=2
- PerformanceData table structure ready for cue/loop storage
- Serialization pattern from beatgrid can be adapted

**From Story 2.1 (Waveform Renderer):**
- `WaveformDetail` component handles zoomed view
- `viewRange` prop controls visible portion
- Click/drag interactions established - extend for cue placement

### Existing Code Integration Points

**Files to Modify:**
```
src/modules/audio/components/WaveformDetail.tsx  # Add cue/loop overlay integration
src/modules/audio/components/DeckUI.tsx          # Add pad & loop controls
src/modules/audio/services/analysis.service.ts   # Add cue/loop CRUD methods
src/modules/audio/services/deck-loader.service.ts # Load cue/loop data on track load
src/modules/audio/store/audio.store.ts           # Add cue/loop state to DeckState
```

**Files to Create:**
```
src/modules/audio/components/CueMarkerOverlay.tsx   # Cue point visualization
src/modules/audio/components/LoopRegionOverlay.tsx  # Loop region visualization
src/modules/audio/components/PerformancePads.tsx    # 8-pad cue trigger UI
src/modules/audio/components/LoopControls.tsx       # Loop in/out/length controls
src/modules/audio/components/CueContextMenu.tsx     # Right-click menu for cue/loop
src/modules/audio/types/cue-loop.ts                 # Type definitions
```

### Engine DJ Database Schema Reference

**PerformanceData table (from engine-dj-schema.sql):**
```sql
-- type: 1=HotCue, 2=Loop, 3=Beatgrid, 4=Waveform
-- For Hot Cues (type=1):
--   data contains: position (samples), color index, name
-- For Loops (type=2):
--   data contains: in-point, out-point, color index, name

INSERT INTO PerformanceData (trackId, type, data)
VALUES (?, 1, ?);  -- Hot Cue

INSERT INTO PerformanceData (trackId, type, data)
VALUES (?, 2, ?);  -- Loop
```

### Data Structures

```typescript
// Hot Cue data structure (Engine DJ compatible)
interface HotCueData {
  index: number;        // Pad number 0-7 (display as 1-8)
  position: number;     // Sample position
  color: CueColor;      // Color index from palette
  name: string;         // User-defined label (optional)
  isSet: boolean;       // Whether cue point is assigned
}

// Loop data structure (Engine DJ compatible)
interface LoopData {
  index: number;        // Loop slot 0-7
  inPoint: number;      // Start sample position
  outPoint: number;     // End sample position
  color: CueColor;      // Color index from palette
  name: string;         // User-defined label (optional)
  isActive: boolean;    // Currently looping
}

// Engine DJ standard color palette
type CueColor =
  | 'red'      // #FF0000
  | 'orange'   // #FF8000
  | 'yellow'   // #FFFF00
  | 'green'    // #00FF00 (Engine Green for default)
  | 'cyan'     // #00FFFF
  | 'blue'     // #0000FF
  | 'purple'   // #8000FF
  | 'pink';    // #FF00FF

const CUE_COLOR_HEX: Record<CueColor, string> = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#4DFA90',    // Engine Green (default)
  cyan: '#5AC8FA',
  blue: '#007AFF',
  purple: '#AF52DE',
  pink: '#FF2D92',
};
```

### Visual Design Requirements

**From UX Design Specification:**
- Cue markers: Triangle pointing down at sample position, filled with cue color
- Loop regions: Semi-transparent fill (20% opacity) with solid border, bracket markers at in/out points
- Active loop: Engine Green highlight, pulsing border
- Pad buttons: 44px minimum touch target, show pad number and color
- Context menu: Dark background (#121212), Engine Green highlights

**Cue Marker Visual:**
```
     ▼ (pad number)
     │
─────┼───── (waveform)
```

**Loop Region Visual:**
```
[│================│] (loop region with brackets)
   ↑ in-point    ↑ out-point
```

### Keyboard Shortcuts

```typescript
const CUE_SHORTCUTS = {
  '1': 0, '2': 1, '3': 2, '4': 3,  // Pads 1-4
  '5': 4, '6': 5, '7': 6, '8': 7,  // Pads 5-8
};

// L key: Toggle loop mode
// Shift + L: Set loop out point (when loop mode active)
// Escape: Exit loop mode / deselect cue
```

### Performance Targets

- **Cue trigger latency:** <16ms from keypress to visual update
- **Database write:** Async, should not block UI (optimistic update)
- **Marker rendering:** O(log n) for visible marker calculation
- **Context menu:** <50ms to appear on right-click

### Error Handling

```typescript
export type CueLoopError =
  | { type: 'NO_TRACK'; message: string }
  | { type: 'SAVE_FAILED'; message: string }
  | { type: 'INVALID_POSITION'; message: string }
  | { type: 'PAD_OCCUPIED'; message: string };
```

- If pad is already occupied, show confirmation before overwriting
- If database save fails, rollback optimistic update and show error toast
- If track has no analysis data, show warning "Analyze track first for accurate cue placement"

### Git Commit Convention

Follow established patterns from recent commits:
- `feat(audio):` prefix for new audio module features
- `feat(cue):` or `feat(loop):` for specific features
- Reference story number in commit body

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Context Menus]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Optimistic State Updates]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Keyboard is King]
- [Source: _bmad-output/planning-artifacts/architecture.md#Split-Brain Actor Model]
- [Source: _bmad-output/implementation-artifacts/2-3-slip-under-beatgrid-editing.md]
- [Source: _bmad-output/implementation-artifacts/2-2-automated-track-analysis-bpm-key-grid.md]
- [Source: src/modules/audio/services/analysis.service.ts#PERFORMANCE_DATA_TYPE]
- [Source: src/modules/audio/components/BeatgridOverlay.tsx]
- [Source: src/modules/database/schema/engine-dj-schema.sql#PerformanceData]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
