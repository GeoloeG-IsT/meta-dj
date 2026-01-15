# Story 1.2: Local Folder Ingestion

Status: done

## Story

As a DJ,
I want to import a local folder of music files,
So that I can populate my library with my existing collection.

## Acceptance Criteria

1. **Given** the user is on the Library screen
2. **When** they drag and drop a folder or click "Import Folder"
3. **Then** the browser should request read permission via File System Access API
4. **And** the app should scan the folder recursively for supported audio files (MP3, WAV, AIFF, FLAC, M4A)
5. **And** for each file, extract metadata (Artist, Title, BPM, Key, Artwork) using a parsing library
6. **And** insert a record into the `Track` table for each file
7. **And** show a progress bar indicating import status
8. **And** handle duplicates by checking file hashes or filenames

## Tasks / Subtasks

- [x] Task 1: Setup Library Module Structure (AC: N/A)
  - [x] Create `src/modules/library/components`
  - [x] Create `src/modules/library/store`
  - [x] Create `src/modules/library/service` (for file scanning logic)
  - [x] Define `Track` interface in `src/shared/types` matching DB schema

- [x] Task 2: Implement File System Access Service (AC: 3, 4)
  - [x] Implement `openDirectoryPicker` wrapper
  - [x] Implement recursive directory scanner
  - [x] Filter for supported extensions (mp3, wav, aiff, flac, m4a)

- [x] Task 3: Metadata Extraction (AC: 5)
  - [x] Install `music-metadata-browser` (or similar)
  - [x] Create utility to parse file metadata
  - [x] Extract: Artist, Title, Album, BPM, Key, Duration, Artwork (blob)
  - [x] *Perf*: Run parsing in a `MetadataWorker` or chunk the work to avoid UI freeze

- [x] Task 4: Database Ingestion (AC: 6, 8)
  - [x] Define `IngestTrack` command in `db.worker` protocol
  - [x] Implement `INSERT OR IGNORE` or check-then-insert logic in `db.worker` for deduplication
  - [x] Map metadata to `Track` table columns (snake_case)

- [x] Task 5: UI Integration & Progress (AC: 1, 2, 7)
  - [x] Add "Import Folder" button to Library header
  - [x] Implement drag-and-drop zone using `react-dropzone` or native API
  - [x] Create `ImportProgress` component/store to show count (e.g., "Importing 150/500")

## Dev Notes

### Architecture Compliance
- **Split-Brain**: The UI (Main Thread) handles the File Handle acquisition and directory scanning.
- **Database**: The ACTUAL writes must happen in the `db.worker`. Do not write to SQLite from the main thread.
- **Messaging**: The UI should batch tracks or send them one-by-one to the DB Worker. For 50k tracks, batching (e.g., 50 at a time) is recommended to reduce message overhead.
- **Performance**: Metadata parsing is CPU intensive. If possible, offload to a separate worker or ensure it yields to the main thread frequently.

### Data Integrity
- **Deduplication**: Use file path or hash as unique constraint. `m.db` usually uses `id` (auto-inc). External drives might need path mapping. For local ingestion, absolute path is the key.
- **Schema**: Ensure the `Track` object matches `libdjinterop` / Engine DJ schema.

### Project Structure Notes
- `src/modules/library` is the home for this feature.
- `src/modules/database/worker/db.worker.ts` needs to handle the `INGEST_TRACK` command.

### References
- [Architecture: Data Architecture](_bmad-output/planning-artifacts/architecture.md#data-architecture)
- [Architecture: Project Structure](_bmad-output/planning-artifacts/architecture.md#complete-project-directory-structure)
- [Epics: Story 1.2](_bmad-output/planning-artifacts/epics.md#story-12-local-folder-ingestion)

## Dev Agent Record

### Agent Model Used
Antigravity (Google Deepmind)

# Story 1.2: Local Folder Ingestion

Status: ready-for-dev

## Story

As a DJ,
I want to import a local folder of music files,
So that I can populate my library with my existing collection.

## Acceptance Criteria

1. **Given** the user is on the Library screen
2. **When** they drag and drop a folder or click "Import Folder"
3. **Then** the browser should request read permission via File System Access API
4. **And** the app should scan the folder recursively for supported audio files (MP3, WAV, AIFF, FLAC, M4A)
5. **And** for each file, extract metadata (Artist, Title, BPM, Key, Artwork) using a parsing library
6. **And** insert a record into the `Track` table for each file
7. **And** show a progress bar indicating import status
8. **And** handle duplicates by checking file hashes or filenames

## Tasks / Subtasks

- [x] Task 1: Setup Library Module Structure (AC: N/A)
  - [x] Create `src/modules/library/components`
  - [x] Create `src/modules/library/store`
  - [x] Create `src/modules/library/service` (for file scanning logic)
  - [x] Define `Track` interface in `src/shared/types` matching DB schema

- [x] Task 2: Implement File System Access Service (AC: 3, 4)
  - [x] Implement `openDirectoryPicker` wrapper
  - [x] Implement recursive directory scanner
  - [x] Filter for supported extensions (mp3, wav, aiff, flac, m4a)

- [x] Task 3: Metadata Extraction (AC: 5)
  - [x] Install `music-metadata-browser` (or similar)
  - [x] Create utility to parse file metadata
  - [x] Extract: Artist, Title, Album, BPM, Key, Duration, Artwork (blob)
  - [x] *Perf*: Run parsing in a `MetadataWorker` or chunk the work to avoid UI freeze

- [x] Task 4: Database Ingestion (AC: 6, 8)
  - [x] Define `IngestTrack` command in `db.worker` protocol
  - [x] Implement `INSERT OR IGNORE` or check-then-insert logic in `db.worker` for deduplication
  - [x] Map metadata to `Track` table columns (snake_case)

- [x] Task 5: UI Integration & Progress (AC: 1, 2, 7)
  - [x] Add "Import Folder" button to Library header
  - [x] Implement drag-and-drop zone using `react-dropzone` or native API
  - [x] Create `ImportProgress` component/store to show count (e.g., "Importing 150/500")

## Dev Notes

### Architecture Compliance
- **Split-Brain**: The UI (Main Thread) handles the File Handle acquisition and directory scanning.
- **Database**: The ACTUAL writes must happen in the `db.worker`. Do not write to SQLite from the main thread.
- **Messaging**: The UI should batch tracks or send them one-by-one to the DB Worker. For 50k tracks, batching (e.g., 50 at a time) is recommended to reduce message overhead.
- **Performance**: Metadata parsing is CPU intensive. If possible, offload to a separate worker or ensure it yields to the main thread frequently.

### Data Integrity
- **Deduplication**: Use file path or hash as unique constraint. `m.db` usually uses `id` (auto-inc). External drives might need path mapping. For local ingestion, absolute path is the key.
- **Schema**: Ensure the `Track` object matches `libdjinterop` / Engine DJ schema.

### Project Structure Notes
- `src/modules/library` is the home for this feature.
- `src/modules/database/worker/db.worker.ts` needs to handle the `INGEST_TRACK` command.

### References
- [Architecture: Data Architecture](_bmad-output/planning-artifacts/architecture.md#data-architecture)
- [Architecture: Project Structure](_bmad-output/planning-artifacts/architecture.md#complete-project-directory-structure)
- [Epics: Story 1.2](_bmad-output/planning-artifacts/epics.md#story-12-local-folder-ingestion)

## Dev Agent Record

### Agent Model Used
Antigravity (Google Deepmind)

### Debug Log References

### Completion Notes List
- Implemented `FileSystemService` for recursive scanning.
- Integrated `music-metadata-browser` for extracting metadata.
- Implemented `INGEST_TRACK` in `db.worker` with `INSERT OR UPDATE` logic.
- Created `ImportControl` UI with progress feedback.
- Refactored `DatabaseService` to share worker instance with `useDbWorker` hook.
- Verified with unit tests for file system and metadata services.

### Review Follow-ups (AI)
- [x] [AI-Review][Critical] Fixed Data Integrity Risk: Refactored `FileSystemService` to preserve relative paths recursively.
- [x] [AI-Review][Critical] Fixed `ImportControl` to use correct `scannedFile.path` as unique key for DB, preventing collisions.
- [x] [AI-Review][Medium] Fixed Type Safety: Removed `any` cast in `db.worker` `INGEST_TRACK` command.
- [x] [AI-Review][Medium] Fixed `no-case-declarations` lint errors in worker.

### File List
- src/modules/database/worker/db.worker.ts
- src/modules/database/service.ts
- src/modules/library/service/metadata.ts
- src/modules/library/service/metadata.test.ts
- src/modules/library/service/file-system.ts
- src/modules/library/service/file-system.test.ts
- src/modules/library/components/ImportControl.tsx
- src/shared/types/db-types.ts
- src/shared/kernel/message-bus.ts
- src/App.tsx
- vite.config.ts
