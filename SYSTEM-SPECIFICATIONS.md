## DJ Library Platform — System-Level Specification

### Overview
A local-first desktop/web app for DJs to organize, analyze, and perform with their music library, with seamless cloud sync across devices. It aims to match core features of `rekordbox`/`Engine DJ` and add automation such as BPM/key detection, beatgrids, auto cues/loops, waveform generation, and device exports. The product prioritizes reliability, speed, and offline use; cloud augments collaboration and multi-device continuity.

### Goals
- Local-first library with robust sync and conflict resolution.
- High-accuracy, fast audio analysis (BPM, key, beatgrid, loudness).
- Automated cue/loop suggestions and smart playlists.
- Interoperable exports (USB, `rekordbox` XML, Engine DJ structures, M3U).
- Import from `rekordbox`, Serato, Traktor, Engine DJ where possible.
- Cross-platform (Windows/macOS/Linux) with consistent UX.
- Scales to very large libraries (≥1M tracks).

### Non-Goals (v1)
- Full DVS/mixing engine; focus on prep/management.
- Cloud streaming of full audio files (rights/latency concerns).
- Social sharing beyond basic link-sharing of playlists/metadata.

### Personas & Primary Use Cases
- Club/festival DJ: fast prep, reliable exports, consistent beatgrids/cues across devices.
- Mobile/wedding DJ: robust crates, rapid searching, smart lists, history tracking.
- Producer/DJ: deep tagging, versions, stems (future).
- Multi-device DJ: laptop + desktop + backup USB in sync.

### Functional Requirements
- Library
  - Import local folders; watch changes (adds, moves, deletes).
  - Track metadata: title, artist, album, artwork, labels, comments, color, rating, year, genre, custom tags.
  - Audio metadata: duration, bitrate, sample rate, channels, codecs.
  - Normalization: ReplayGain/EBU R128 integrated loudness and per-track peak.
- Playlists and Crates
  - Static and smart playlists (rules by fields/tags/BPM/key/date added/plays).
  - Hierarchies, sorting, per-playlist cues visibility and notes.
- Analysis & Automation
  - BPM detection with double/half detection correction.
  - Beatgrid with downbeat detection; manual grid adjust and anchors.
  - Musical key detection (Camelot/Open Key and standard).
  - Loudness (LUFS), peak, waveform (multi-resolution).
  - Auto hot cues and loops based on structure (intro/outro, drop, breakdown).
  - Silence trim detection; intro/outro length estimation.
- Editing
  - Cue/loop create/edit/delete, naming/coloring, snap-to-grid.
  - Grid adjustment tools; flexible beat markers; tempo drift handling.
- Search & Browse
  - Full-text, faceted, and advanced filters; fast prefix search.
- History & Insights
  - Play history, last export time, per-venue annotations (future), track usage stats.
- Export/Import
  - USB/device export: folder structure, M3U, `rekordbox` XML, Engine-compatible metadata files where feasible.
  - Artwork and waveform export for target ecosystem expectations.
  - Import: `rekordbox` XML, Serato crates, Traktor NML, Engine DB (read-only, as of 2025-08-10 formats may be proprietary).
- Sync (Cloud)
  - User accounts, encrypted at rest.
  - Multi-device sync of metadata, playlists, grids, cues/loops, analysis products (waveforms optional).
  - Per-field merges and conflict UI.
- Offline-first
  - All primary operations offline; background sync resumes when online.
- Accessibility & i18n
  - Keyboard-first workflows; screen-reader support; localizable UI strings.

### Non-Functional Requirements
- Performance
  - Analysis throughput: ≥50 tracks/min on 4-core CPU for MP3/FLAC; GPU optional.
  - Search latency: <50 ms for common queries on 100k tracks.
  - App cold start: <3 s on typical laptop, warm: <1 s.
- Reliability & Data Integrity
  - Crash-safe local DB (WAL journaling), atomic writes, background checkpoints.
- Scalability
  - Libraries up to ≥1M tracks; incremental indexing and paging.
- Portability
  - Win/macOS/Linux parity; no platform-specific regressions.
- Security/Privacy
  - End-to-end encryption for sensitive notes/tags optional; at-rest encryption for cloud; no audio uploaded unless opted-in.
- Observability
  - Structured local logs; opt-in telemetry; privacy-safe metrics.

### System Architecture
- Desktop/Web App
  - UI: Electron (desktop) or PWA (web) with shared core logic.
  - Local DB: SQLite (WAL) for metadata; FTS5 for search.
  - File watcher: tracks filesystem changes.
  - Analysis workers: native add-ons (Rust/C++/WASM) for DSP; job queue.
  - Sync agent: change journal, background sync, conflict resolver.
- Cloud Services
  - API: auth, delta sync, device registry, link sharing.
  - Data: Postgres for user/library metadata; object storage for binary blobs (artwork, waveforms); queues for background jobs.
  - Merge service: per-field CRDT/OT or version-vector merges; audit log.

### Component Diagram (Mermaid)
- Include in docs as needed:
```mermaid
graph LR
  UI[Desktop/Web UI] --> Core[Core Library]
  Core -->|FS events| Watcher
  Core -->|SQL| SQLite[(SQLite + FTS5)]
  Core --> Queue[Analysis Queue]
  Queue --> DSP[Analyzer (Rust/C++/WASM)]
  Core --> Sync[Sync Agent]
  Sync --> API[(Cloud API)]
  API --> DB[(Postgres)]
  API --> Blobs[(Object Storage)]
  API --> MQ[(Queue/Workers)]
```

### Data Model (Entities)
- User(id, email, authProvider, createdAt)
- Device(id, userId, name, platform, lastSeenAt)
- Library(id, userId, settings, version)
- Track(id, contentHash, filePath, fileId?, duration, codec, sampleRate, bitRate, channels, addedAt, modifiedAt)
- Artist(id, name), Album(id, name, year), Artwork(id, trackId, blobHash)
- TrackArtist(trackId, artistId, role)
- Analysis(id, trackId, bpm, bpmConfidence, key, keyConfidence, beatgridJson, lufs, peak, waveformRef, version, analyzerVersion, createdAt)
- Cue(id, trackId, positionMs, color, label, type[HOT, MEMORY], autogen:bool)
- Loop(id, trackId, startMs, lengthBeats, color, label, autogen:bool)
- Playlist(id, parentId?, name, smartRulesJson?, order)
- PlaylistTrack(playlistId, trackId, position)
- Tags(id, name, color); TrackTag(trackId, tagId)
- ChangeLog(id, entityType, entityId, field, valueHash, deviceId, ts, vv)
- ExportProfile(id, userId, target[Rekordbox, Engine, M3U], optionsJson)

Note: binary blobs (artwork, waveform) deduplicated via `contentHash`.

### Sync & Conflict Resolution
- Local-first with change journal. Each change carries (deviceId, lamportClock, vectorClock).
- Per-field merge strategies:
  - Simple fields: last-writer-wins (with timestamp and device bias).
  - Lists (cues/loops): merge by stable IDs; conflict prompts UI.
  - Playlists: OT for ordered lists; position merges by tombstones.
- Attach analyzerVersion to analysis artifacts; re-run when version upgrades.
- Blob sync via content-addressable storage; resumable uploads.
- Privacy: configurable fields to exclude from sync (e.g., private notes).

### Analysis Pipeline
- Steps: decode -> resample -> downmix -> onset detection -> tempo estimation -> dynamic programming beat tracking -> downbeat -> key estimation (HPCP/NN) -> LUFS -> waveform (multi-res) -> auto-cue/loop heuristics.
- Heuristics:
  - Place hot cues at: first downbeat, first drop (energy spike), breakdown start, outro start; mark loops around intro/outro with 8/16/32 beats.
  - Correct BPM halves/doubles using bar length consistency and tempo histogram.
- Performance:
  - Parallelize by track; SIMD; optional GPU (compute shaders).
  - Cache intermediate products keyed by `contentHash`.
- Extensibility:
  - Plugin API for analyzers; sandbox and versioned outputs.

### Device Export
- File copying with integrity checks; path templating.
- Metadata exports:
  - M3U and extended M3U8 playlists.
  - Rekordbox XML (as of 2025-08-10 RB6+ DB is proprietary; XML import/export still supported with caveats).
  - Engine DJ: replicate folder/playlist and analysis files where legal; document limits.
- Verification: re-ingest export to ensure fidelity.

### APIs (Cloud)
- Auth: `POST /v1/auth/*`
- Library Sync:
  - `GET /v1/sync/changes?since=cursor`
  - `POST /v1/sync/changes`
  - `PUT /v1/tracks/:id`, `PUT /v1/playlists/:id`, `PUT /v1/cues/:id`, …
- Blobs:
  - `POST /v1/blobs` (S3 pre-signed), `GET /v1/blobs/:hash`
- Devices:
  - `GET /v1/devices`, `POST /v1/devices`
- Sharing:
  - `POST /v1/share/playlist/:id` (link-token), `GET /v1/share/:token` (public view)

Design per REST best practices; paginate; idempotency keys for writes.

### Observability
- Client: structured logs; trace spans around analysis/sync; offline log ring buffer.
- Server: request logging, traces, metrics (sync lag, merge conflicts, error rates).

### Testing Strategy
- Unit: analyzers with golden files; merge logic; playlist rules engine.
- Integration: sync round-trips, importers/exporters (fixture corpora).
- E2E: large library smoke (100k tracks), filesystem churn, offline/online flaps.
- Performance: throughput and latency budgets with regression thresholds.

### Migration & Import
- Importers for `rekordbox` XML, Serato crates, Traktor NML, Engine DB reads where feasible.
- Versioned migrations for local DB; background re-analysis on analyzerVersion bump.

### Security & Privacy
- OAuth2/OIDC; short-lived access tokens; refresh tokens in secure store.
- TLS everywhere; at-rest encryption (cloud DB/blobs).
- Minimize PII; opt-in telemetry; clear data export/delete tools.

### Risks & Open Questions
- Proprietary DB formats evolving (rekordbox/Engine). Mitigate with XML/M3U and documented limits.
- Key detection accuracy across genres; need training data.
- Handling drift and tempo changes; flexible beatgrid UX.
- Sync conflict UX complexity at 1M-track scale.

### Acceptance Criteria
- Local library usable offline; import, analyze, edit, search, and export function reliably.
- Sync propagates edits across two devices within 5 s for small deltas; conflict resolution UI available.
- Analysis accuracy: BPM ≥98% within ±1 BPM; key detection ≥85% on benchmark; downbeat F1 ≥0.85.
- Export re-ingestion parity ≥99.9% for playlists/tracks/cues/loops on supported formats.
- Performance budgets met (see Non-Functional).

### Verification Steps
1. Create library with 10k tracks; run full analysis; verify throughput and artifact generation.
2. Simulate edits on device A and B; verify merges; review conflict resolutions.
3. Export to USB (M3U + XML); validate by re-importing; compare metadata/cues/loops.
4. Import from `rekordbox` XML and Serato; spot-check 100 tracks for parity.
5. Kill app mid-write; verify DB integrity and zero data loss on restart.
6. Switch network offline/online during sync; ensure consistent convergence.