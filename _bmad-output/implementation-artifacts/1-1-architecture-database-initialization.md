# Story 1.1: Architecture & Database Initialization

**Status:** done

## Story

**As a** Developer,
**I want** to initialize the project structure and the "Split-Brain" Worker with SQLite database,
**So that** the heavy business logic and data layer run off the main thread, ensuring a 60fps UI.

## Acceptance Criteria

1. **Project Verification**: The application must be initialized using the correct Vite+React+TS template.
2. **Worker Spawning**: The app must spawn a dedicated Web Worker (`db.worker.ts`) on startup.
3. **Messaging Bridge**: A robust, typed messaging system (Kernel) must exist between the Main Thread (Shell) and Worker.
4. **SQLite Initialization**: The Worker must successfully initialize SQLite WASM and mount the Origin Private File System (OPFS).
5. **Schema Creation**: The `m.db` and `p.db` database files must be created with the correct tables (Track, Playlist) matching the Engine DJ schema.
6. **WAL Mode**: Verify that SQLite is running in WAL (Write-Ahead Logging) mode for performance.

## Tasks / Subtasks

- [x] **Task 1: Project Initialization & Structure**
    - [x] Initialize Vite project (`npm create vite@latest meta-dj -- --template react-ts`)
    - [x] Clean up default boilerplate (remove `App.css`, default assets)
    - [x] Create folder structure per Architecture: `src/modules`, `src/shared`, `src/assets`
    - [x] Install critical dependencies (`sqlite3`, `zustand`, `comlink` or equivalent for messaging)
    - [x] Configure `vite.config.ts` for Worker support and SharedArrayBuffer headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`)

- [x] **Task 2: Shared Kernel & Types**
    - [x] Define global types in `src/shared/types` (e.g., `WorkerMessage`, `Result`)
    - [x] Implement typed Message Bus in `src/shared/kernel/message-bus.ts`
    - [x] Define the Database Action types (e.g., `DB_INIT`, `EXEC_SQL`)

- [x] **Task 3: Database Worker Implementation**
    - [x] Create `src/modules/database/worker/db.worker.ts`
    - [x] Implement `sqlite3` WASM loading logic
    - [x] Implement OPFS mounting logic
    - [x] Handle `DB_INIT` message to startup the DB

- [x] **Task 4: Schema Definition & Applied**
    - [x] Create `src/modules/database/schema/engine-schema.sql` with `Create Table` statements for `Track` and `Playlist`
    - [x] Implement logic in Worker to apply this schema if DB doesn't exist (`m.db`, `p.db`)
    - [x] Verify creation of files in OPFS

- [x] **Task 5: Main Thread Integration**
    - [x] Create `src/modules/database/service.ts` to spawn the worker
    - [x] Create a hook `useDatabaseInitialization` to trigger init on app mount
    - [x] Log success/failure to console proving connection

## Dev Notes

### Architecture Pattern: Split-Brain
- **Strict Isolation**: `db.worker.ts` MUST NOT import any React components or DOM-related libraries.
- **Communication**: Use the `WorkerMessage` pattern defined in Architecture.
  ```typescript
  type WorkerMessage<T> = { id: string; type: string; payload: T; timestamp: number; }
  ```

### Database Schema (Engine DJ Compatibility)
- **Tables**: `Track`, `Playlist`, `PlaylistEntity`.
- **Naming**: Strict `snake_case` for columns.
- **Files**:
  - `m.db`: Main library data (Tracks, metadata).
  - `p.db`: Performance data (Waveforms, Beatgrids) - *Note: For this story, just ensuring creation is enough, strict schema details for p.db can be refined later if complex.*

### Technical Constraints
- **WASM**: Ensure `sqlite3.wasm` is served correctly (check `content-type`).
- **Headers**: COOP/COEP headers are REQUIRED for `SharedArrayBuffer` (future use) and high-performance Worker isolation. Configure in `vite.config.ts` server settings.

### File Structure
- `src/modules/database` -> Worker and Schema logic.
- `src/shared/kernel` -> Message Bus.

## Dev Agent Record

### Agent Model Used
- `dev-agent-initial`

### Debug Log References
- *None*

### Completion Notes
- Validated implementation of Split-Brain architecture (Worker + Main Thread).
- Verified `sqlite3` WASM loading and schema application.
- Confirmed project structure and dependencies.

### File List
- src/modules/database/worker/db.worker.ts
- src/modules/database/schema/engine-schema.sql
- src/modules/database/service.ts
- src/shared/kernel/message-bus.ts
- src/shared/types/db-types.ts
- src/shared/types/index.ts
- src/shared/hooks/useDatabaseInitialization.ts
- vite.config.ts
- package.json

## Senior Developer Review (AI)

- **Date:** 2026-01-16
- **Reviewer:** Antigravity
- **Outcome:** Approved with Fixes

### Findings & Fixes
- **Fixed:** Replaced `any` type in `db.worker.ts` with explicit `SQLiteDatabase` interface.
- **Fixed:** Removed unused `comlink` dependency.
- **Note:** `sqlite-wasm` types are suppressed with `@ts-expect-error`, which is acceptable as official types are missing.

### Change Log
- 2026-01-16: Automated Code Review - Fixed types and cleanup - Status moved to `done`.
