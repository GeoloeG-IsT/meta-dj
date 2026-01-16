# Story 1.6: Full-Text Search (FTS) & Type-Ahead

Status: review

## Story

As a user,
I want to instantly find tracks by typing, without clicking a search bar,
So that I can search quickly during a performance without risk of "focus trapping" my keyboard shortcuts.

## Acceptance Criteria

1. [x] **FTS5 Virtual Table**: Create a `Track_fts` virtual table in `m.db` using the SQLite `fts5` extension.
2. [x] **Automatic Synchronization**: Implement SQLite triggers to automatically keep `Track_fts` in sync with the `Track` table (on INSERT, UPDATE, DELETE).
3. [x] **Global Keyboard Capture**: Implement a "Type-Ahead" listener that captures alphanumeric key presses when the Library view is active and automatically initiates a search.
4. [x] **Search UI Overlay**: Implement a sleek, non-intrusive search overlay (OLED Black/Engine Green) that appears when typing starts and shows the current query.
5. [x] **Search Performance**: Ensure search results for a library of 10,000+ tracks are returned and rendered in <50ms.
6. [x] **Esc to Clear**: Pressing `Esc` must clear the search, hide the overlay, and restore the original track list view.

## Tasks / Subtasks

- [x] **Database Foundation (FTS5)**
  - [x] Initialize `Track_fts` virtual table in `database.worker.ts`.
  - [x] Add `title`, `artist`, `album` columns to the FTS index.
  - [x] Implement triggers for `Track` -> `Track_fts` synchronization.
- [x] **Search Logic**
  - [x] Updated `useTracks` hook to use the `MATCH` operator for high-performance indexing.
- [x] **Type-Ahead UI Implementation**
  - [x] Create `src/modules/library/components/SearchOverlay.tsx`.
  - [x] Implement a global `window` keyboard listener in `LibraryView.tsx`.
  - [x] Filter out key events when a Modal is active.
- [x] **Hook Integration**
  - [x] Updated `useTracks` to accept an optional `searchQuery`.
- [x] **UX Polishing**
  - [x] Added animations for the search overlay using Framer Motion.

## Dev Agent Record

### Agent Model Used
Gemini 2.0 Flash

### Debug Log References
- Build successful.
- SQLite FTS5 extension verified operational in WASM.
- Triggers verified syncing data from Track to Track_fts.
- Global key listener optimized to ignore input fields.

### Completion Notes List
- Implemented full-text search across Title, Artist, and Album.
- Integrated Type-Ahead UI that appears instantly when typing.
- Maintained "Split-Brain" integrity by performing all heavy indexing in the worker.

### File List
- `src/modules/database/worker/database.worker.ts`
- `src/modules/library/components/SearchOverlay.tsx`
- `src/modules/library/hooks/useTracks.ts`
- `src/modules/library/LibraryView.tsx`
- `src/modules/library/components/TrackList.tsx`
