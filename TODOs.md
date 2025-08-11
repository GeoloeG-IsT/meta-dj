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


