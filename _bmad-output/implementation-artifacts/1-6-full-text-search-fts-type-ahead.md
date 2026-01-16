# Story 1.6: Full-Text Search (FTS) & Type-Ahead

Status: done

...

## Dev Agent Record

### Agent Model Used
Gemini 2.0 Flash (Implementation & Review Fixes)

### Debug Log References
- Build successful.
- SQLite FTS5 extension verified operational in WASM.
- Triggers verified syncing data from Track to Track_fts.
- Global key listener optimized to ignore input fields and support Unicode.
- **Refinement (2026-01-16):** Added FTS query sanitization (Unicode-safe) and sorting whitelist for improved robustness and security. Optimized FTS initialization to avoid redundant rebuilds.

### Completion Notes List
- Implemented full-text search across Title, Artist, and Album with Unicode support.
- Integrated Type-Ahead UI that appears instantly when typing.
- Maintained "Split-Brain" integrity by performing all heavy indexing in the worker.
- Standardized search results combined with Playlist filtering.
- Improved UI with Lucide icons and context-aware track actions (Remove vs Delete).

### File List
- `src/modules/database/worker/database.worker.ts`
- `src/modules/library/components/SearchOverlay.tsx`
- `src/modules/library/hooks/useTracks.ts`
- `src/modules/library/LibraryView.tsx`
- `src/modules/library/components/TrackList.tsx`
- `src/modules/library/components/PlaylistItem.tsx`
- `src/modules/library/components/PlaylistTree.tsx`
- `src/modules/library/services/playlist.service.ts`
- `src/modules/library/store/library.store.ts`
