# Story 1.7: Smartlist Visual Query Builder

Status: in-progress

## Story

As a user,
I want to create dynamic playlists based on rules (e.g., BPM > 120 and Genre is 'House'),
so that my music collection organizes itself automatically as I add new tracks.

## Acceptance Criteria

1. **Rule Definition:** Users must be able to add multiple rules with logic (AND/OR) for fields: BPM, Key, Genre, Rating, and Date Added. [Source: epics.md#Story 1.7]
2. **SQL Translation:** The system must translate these rules into a valid SQL `WHERE` clause to execute against the `Track` table. [Source: epics.md#Story 1.7]
3. **Dynamic Updates:** The resulting smartlist must update dynamically whenever the library database changes (e.g., when new tracks are ingested). [Source: epics.md#Story 1.7]
4. **Binary Compatibility:** The implementation must align with Engine DJ database structures, specifically updating the `Playlist` table and potentially creating a `SmartListRule` table for persistence. [Source: architecture.md#Data Architecture]
5. **UI Polishing:** The Query Builder UI must follow the "OLED Black" design tokens (#000000) with "Engine Green" (#4DFA90) accents. [Source: epics.md#Additional Requirements]

## Tasks / Subtasks

- [x] **Schema Migration** (AC: 4)
  - [x] Update `Playlist` table to include `isSmartList` (BOOLEAN).
  - [x] Create `SmartListRule` table: `id`, `playlistId`, `field`, `operator`, `value`, `logic` (AND/OR).
- [ ] **Worker Logic Implementation** (AC: 2, 3)
  - [ ] Implement SQL generation logic in `database.worker.ts` to convert `SmartListRule` arrays into `WHERE` clauses.
  - [ ] Update `DB_QUERY_REQUEST` to handle smartlist-specific queries.
- [ ] **Service Layer Updates** (AC: 2, 4)
  - [ ] Add `getSmartListRules(playlistId)` and `saveSmartListRules(playlistId, rules)` to `PlaylistService`.
  - [ ] Update `getHierarchy` to include `isSmartList` flag.
- [ ] **Visual Query Builder UI** (AC: 1, 5)
  - [ ] Create `SmartListBuilder.tsx` component using Tailwind CSS.
  - [ ] Implement "Add Rule" and "Remove Rule" functionality.
  - [ ] Support dropdowns for `field` (BPM, Key, etc.) and `operator` (=, >, <, contains).
- [ ] **Integration & State Management** (AC: 1, 3)
  - [ ] Update `library.store.ts` to manage smartlist editing state.
  - [ ] Ensure `LibraryView` triggers a refresh when smartlist rules are saved.

## Dev Notes

- **Split-Brain Pattern:** Ensure all heavy SQL generation happens in the `database.worker.ts`. Do NOT generate raw SQL in the UI thread.
- **SQLite Performance:** Use `EXPLAIN QUERY PLAN` to ensure generated smartlist queries are efficient, especially for large libraries (50k+ tracks).
- **Naming Conventions:** Strict `snake_case` for database columns and `PascalCase` for React components.

### Project Structure Notes

- New UI component: `src/modules/library/components/SmartListBuilder.tsx`
- Service update: `src/modules/library/services/playlist.service.ts`
- Worker update: `src/modules/database/worker/database.worker.ts`
- Schema update: `src/modules/database/schema/engine-dj-schema.sql`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: src/modules/database/worker/database.worker.ts#Migration Logic]

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash

### Debug Log References
- [2026-01-16] Added `DB_SMARTLIST_UPDATE` to messaging types.
- [2026-01-16] Created `smartlist.ts` for SQL generation logic.
- [2026-01-16] Created `smartlist.test.ts` (Red phase of TDD).

### Completion Notes List
- Schema migration completed in previous session.
- Started Worker Logic Implementation: defined `SmartListRule` interface and SQL translation stubs.

### File List
- `src/modules/library/components/SmartListBuilder.tsx`
- `src/modules/library/services/playlist.service.ts`
- `src/modules/database/worker/database.worker.ts`
- `src/modules/database/schema/engine-dj-schema.sql`
- `src/modules/library/store/library.store.ts`
- `src/shared/types/messaging.ts`
- `src/modules/database/worker/smartlist.ts`
- `src/modules/database/worker/smartlist.test.ts`
