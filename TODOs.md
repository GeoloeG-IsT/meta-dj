## Implementation TODOs

Short, verifiable tasks. Each task lists acceptance criteria and verification steps. Tackle one at a time.

### M0 — Repository Bootstrap
- [x] Initialize project structure (apps, services, packages, infra, docs, scripts, tests)
  - Acceptance:
    - Directories exist with minimal READMEs
  - Verify:
    - `ls` shows expected tree; READMEs render
- [x] Add shared tooling configs (editorconfig, lint, format, gitignore)
  - Acceptance:
    - Config files present and used in CI
  - Verify:
    - Lint and format commands run locally

### M1 — Local Library MVP
- [x] Define SQLite schema and migrations for core entities (tracks, playlists, cues, analysis)
  - Acceptance:
    - Migration applies; tables created; FTS5 enabled
  - Verify:
    - Run migration; inspect schema
- [x] Implement filesystem watcher and initial folder import
  - Acceptance:
    - New/removed files reflected in DB
  - Verify:
    - Add/remove a file; DB updates
- [x] Basic search via FTS5 (title/artist/album/tags)
  - Acceptance:
    - Queries return expected rows under 50 ms on sample dataset
  - Verify:
    - Seed sample; run queries; measure latency

### M2 — Analysis Engine MVP
- [x] JS placeholder analyzer and integration into CLI
- [x] Rust analyzer crate scaffold and CI build
  - Acceptance:
    - Crate builds in CI; binary prints JSON
  - Verify:
    - CI green; local run returns JSON
  
#### M2.E — Analyzer Evaluation & ML Improvements
- [ ] Extensive analyzer evaluation on curated dataset
  - Acceptance:
    - Evaluation dataset (≥500 tracks) with ground-truth or tag-derived BPM/key created and documented
    - Metrics computed: BPM within ±1 and with half/double normalization; key accuracy with enharmonic normalization
    - Report generated (CSV/Markdown) with per-genre breakdown and error analysis
  - Verify:
    - `npm` (or script) runs end-to-end and outputs metrics and samples of mismatches
- [ ] Investigate ML/AI methods to improve analyzer
  - Acceptance:
    - Survey of modern BPM/key/downbeat models (as of ${DATE}), pros/cons, licenses
    - Prototype experiment(s) integrated behind a flag (WASM/Rust/C++)
    - Performance baseline (throughput, latency, memory) documented vs current
  - Verify:
    - Re-run evaluation with prototype and compare metrics; results summarized in docs
- [ ] Audio decode/resample/downmix pipeline (Rust/C++/WASM binding)
  - Acceptance:
    - Decode MP3/FLAC/WAV; unit tests with fixtures
  - Verify:
    - Golden tests pass
- [ ] BPM + beatgrid with downbeat detection
  - Acceptance:
    - ≥98% within ±1 BPM on benchmark; stable grid on fixtures
  - Verify:
    - Benchmark suite results
- [ ] Waveform (multi-res) and LUFS/peak
  - Acceptance:
    - Artifacts generated; stored and re-used via content hash
  - Verify:
    - Cache hits on re-run; files identical

### M3 — Cues/Loops Automation & Editor
- [ ] Auto hot cues/loops heuristics (intro/outro/drop/breakdown)
  - Acceptance:
    - Heuristics place cues on fixtures; editable in UI
  - Verify:
    - Visual inspection; unit tests for heuristic outputs
- [ ] Cue/loop editor with snap-to-grid and coloring
  - Acceptance:
    - Create/edit/delete; persisted to DB
  - Verify:
    - Round-trip edits survive restart

### M4 — Playlists & Smart Rules
- [ ] Static playlists and hierarchy
  - Acceptance:
    - Create/move/delete; ordering preserved
  - Verify:
    - E2E tests
- [ ] Smart playlists rule engine
  - Acceptance:
    - Rules over fields/tags/BPM/key/date; live updates
  - Verify:
    - Rule test cases pass

### M5 — Exporters
- [x] M3U/M3U8 export with path templating
  - Acceptance:
    - Playlists export/import round-trip parity ≥99.9%
  - Verify:
    - Re-ingest and diff
- [x] Rekordbox XML export (RB XML parity where feasible)
  - Acceptance:
    - Cues/loops/beatgrids appear in Rekordbox on import
  - Verify:
    - Manual import test; sample fixtures
- [ ] Denon Engine DJ export (as feasible)
  - Acceptance:
    - Export playlists and tracks consumable by Engine DJ/Prime (document limitations)
  - Verify:
    - Manual import into Engine DJ; sample fixtures
  - Notes:
    - Engine DJ uses proprietary SQLite layout; may require user-provided sample library to validate

### M6 — Sync MVP
- [ ] Change journal with version vectors
  - Acceptance:
    - Local merges deterministic; audit log present
  - Verify:
    - Simulate conflicting edits; convergence
- [ ] Cloud API for deltas; device registry
  - Acceptance:
    - Two devices sync metadata in <5 s for small deltas
  - Verify:
    - Local + remote sync test harness

### M7 — Importers
- [ ] Rekordbox XML importer
  - Acceptance:
    - Fields/cues/loops map correctly; idempotent
  - Verify:
    - Fixture corpora tests
- [ ] Serato/Traktor/Engine DJ (as feasible)
  - Acceptance:
    - Document limitations; pass fixture tests
  - Verify:
    - Import and compare

### M8 — Performance Hardening
- [ ] Indexing and pagination for 1M-track libraries
  - Acceptance:
    - Search <50 ms; UI remains responsive
  - Verify:
    - Load generator results

### M9 — Observability & Telemetry (Opt-in)
- [ ] Structured logs; client traces; minimal metrics
  - Acceptance:
    - Correlate analysis/sync operations end-to-end
  - Verify:
    - Trace viewer demo

### M10 — Packaging & Releases
- [ ] Desktop builds (Win/macOS/Linux) and PWA packaging
  - Acceptance:
    - Installers build; app starts in <3 s cold
  - Verify:
    - Smoke tests on all platforms

### M11 — Web App (Next.js) MVP
- [ ] Auth pages (sign-in/up) — use Supabase Auth locally
  - Acceptance:
    - Email/password auth works locally; session persisted
  - Verify:
    - Login/logout flows; protected routes redirect
- [ ] Library browser
  - Acceptance:
    - Paginated track list with search/filter (BPM/key/tags)
    - Folder tree visualization of local library (derived from `tracks.file_path`)
    - Selecting a folder shows tracks scoped to that folder and its subfolders
    - Uses REST API (`services/api-go`) for all reads/writes (no direct SQLite in web)
  - Verify:
    - Navigate large folder trees smoothly; folder change updates track list in <150 ms on 10k tracks (sampled)
  - Verify:
    - Queries return expected items; <150 ms interactions
  - Progress:
    - [x] SSR page fetching `/v1/tracks` with query/fields/pagination
    - [x] Folder tree navigation and filtering end-to-end
- [ ] Track detail with waveform and cues/loops editor
  - Acceptance:
    - Renders waveform from artifact; add/edit/delete cues/loops
    - Manual BPM editing and save back to DB (separate from analyzed BPM; track-level override)
    - Buttons to trigger automation (re-analyze, auto-cues)
    - Fetch and persist via REST API
  - Verify:
    - UI updates and persists; reload shows changes; DB rows reflect edits (`analysis` or override fields)
  - Progress:
    - [x] Detail page; BPM override form wired to `PUT /v1/tracks/{id}/bpm-override`
    - [x] Cues editor wired to `/v1/cues` (list/add/delete)
    - [x] Waveform viewer using signed URL via `/v1/storage/sign` (requires Supabase local/auth)
- [ ] Playlists UI (static + smart)
  - Acceptance:
    - Create/move/delete; smart rules editor; results preview
  - Verify:
    - E2E flows pass
- [ ] Batch automation UI
  - Acceptance:
    - Trigger analysis, auto-cues for selections; progress display
  - Verify:
    - Background job feedback; results reflected in UI

### M12 — Backend (Go) MVP
- [ ] Go API scaffold (HTTP, routing, config)
  - Acceptance:
    - Health endpoint; structured logs
  - Verify:
    - `curl /health` returns 200
- [ ] Auth middleware (Supabase JWT verification)
  - Acceptance:
    - Protects routes; extracts user context
  - Verify:
    - Valid/invalid tokens behavior
- [ ] Library endpoints (tracks/playlists/cues/loops CRUD)
  - Acceptance:
    - Round-trip CRUD with Postgres
  - Verify:
    - Integration tests
  - Progress:
    - [x] Tracks: list/get (limit/offset/fields), BPM override
    - [x] Cues: list by track, upsert/delete
    - [ ] Loops: list by track, upsert/delete
- [ ] Search endpoint (FTS proxy / query builder)
  - Acceptance:
    - Returns filtered lists consistent with local FTS
  - Verify:
    - Query tests
- [ ] Analysis orchestration endpoints (enqueue/status)
  - Acceptance:
    - Enqueue analysis; poll status
  - Verify:
    - Worker stub handles job lifecycle

#### M12.A — API Clients Integration (REST)
- [ ] CLI: use REST API for library operations where applicable (search, playlists, cues/loops, analysis triggers); retain offline-local SQLite as fallback
  - Acceptance:
    - Env-configurable API base; graceful offline mode
    - Writes retry/sync when API becomes available
  - Verify:
    - End-to-end flows execute via API with API-only mode toggled in CLI
  - Progress:
    - [x] CLI search via API when `API_BASE` set
    - [x] CLI import via API `/v1/import/scan` (falls back to local)
- [ ] Web: replace direct SQLite reads with REST API data fetching (SSR/ISR as needed)
  - Acceptance:
    - All pages and mutations go through API; no `better-sqlite3` in production paths
  - Verify:
    - Web works with only API and Postgres/MinIO running

#### M12.B — GraphQL API (Optional alongside REST)
- [ ] Implement GraphQL endpoint in Go (e.g., gqlgen) mirroring REST resources (tracks, playlists, cues/loops, analysis)
  - Acceptance:
    - Schema defined and documented; GraphiQL enabled in dev
    - Query and mutation parity for core entities
  - Verify:
    - Example queries/mutations return expected data; integration tests pass
- [ ] Clients (Web/CLI) optional GraphQL path behind feature flag
  - Acceptance:
    - Build-time/runtime flag to select REST vs GraphQL
  - Verify:
    - Smoke tests for both client paths

### M13 — Local Supabase & Orchestration
- [ ] Supabase local configuration (auth, Postgres)
  - Acceptance:
    - Supabase Auth available locally; env wired to web/api
  - Verify:
    - Sign-in works; JWT issued and verified by API
- [ ] Object storage (MinIO) for artifacts
  - Acceptance:
    - Upload/download waveform/artwork via S3 API
  - Verify:
    - Pre-signed URL flow works
- [ ] Docker Compose for dev (db, storage, api-go, web, optional supabase)
  - Acceptance:
    - `docker compose up` brings all services; healthchecks pass
  - Verify:
    - Web connects to API; API connects to DB/storage
  - Progress:
    - [x] Web uses `http://api:8080` internally
    - [x] API mounts `${IMPORT_HOST_ROOT}` to `/import`; supports host→container path remap for imports

### M14 - Add various Object Storage support (S3/GCS/GDrive/Dropbox)
- [ ] S3-compatible storage abstraction layer
  - Acceptance:
    - Common interface for upload/download/delete operations
  - Verify:
    - Interface works with MinIO locally
- [ ] AWS S3 provider implementation
  - Acceptance:
    - Supports IAM roles, regions, bucket policies
  - Verify:
    - Integration tests with AWS S3
- [ ] Google Cloud Storage provider implementation
  - Acceptance:
    - Service account auth; lifecycle management
  - Verify:
    - Integration tests with GCS
- [ ] Google Drive API provider implementation
  - Acceptance:
    - OAuth2 flow; folder-based organization
  - Verify:
    - Upload/download via Drive API
- [ ] Dropbox API provider implementation
  - Acceptance:
    - App token auth; chunked uploads for large files
  - Verify:
    - Integration tests with Dropbox API
- [ ] Storage provider configuration and selection
  - Acceptance:
    - Environment-driven provider selection; fallback chains
  - Verify:
    - Switch providers via config; error handling

