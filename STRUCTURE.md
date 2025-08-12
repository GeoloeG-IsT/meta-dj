## Repository Structure

High-level map of the monorepo. Paths are relative to the repository root.

```
.
├── apps/
│   ├── web/                # Next.js app (Next 14)
│   │   ├── app/            # App Router pages
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── ...
│   └── desktop/            # Desktop app scaffold (README placeholder)
├── services/
│   ├── api-go/             # Go HTTP API (chi, zap, pgx)
│   │   ├── main.go         # Router, health, /v1/sync endpoints
│   │   ├── auth.go         # Optional JWT middleware (via JWT_SECRET)
│   │   ├── sync.go         # In-memory store handlers
│   │   ├── sync_store_pg.go# Postgres-backed change store
│   │   └── Dockerfile
│   └── api/                # Cloud API docs placeholder
├── packages/
│   ├── core/               # Core CLI (SQLite library, search, playlists, export, sync)
│   │   ├── migrations/     # SQLite schema (0001_init.sql)
│   │   └── src/cli.js      # CLI entrypoint and commands
│   ├── analyzer/           # JS analyzer placeholder
│   │   └── src/cli.js
│   ├── analyzer-rs/        # Rust analyzer crate (binary: meta-dj-analyzer-rs)
│   │   └── Cargo.toml
│   └── sync/               # Sync client placeholder
├── infra/                  # Infra-as-code placeholders
├── scripts/
│   ├── migrate-local.sh    # Apply SQLite migrations to local DB
│   └── README.md
├── tests/                  # Unit/integration/e2e/perf tests
├── docs/                   # Documentation index and topical docs
├── docker-compose.yml      # Local orchestration (Postgres, MinIO, API, Web)
├── package.json            # Root scripts (minimal)
├── SECURITY.md
├── SYSTEM-SPECIFICATIONS.md
├── WORKFLOW.md
├── TODOs.md
└── README.md
```

### Services and ports
- `services/api-go`: HTTP on `:8080` (`/health`, `/v1/sync/changes`).
- `apps/web`: Next.js on `:3001`.
- `docker-compose.yml` brings up:
  - Postgres on `:5432` (meta/meta, db `meta_dj`).
  - MinIO on `:9000` (S3 API) and `:9001` (console).
  - API on `:8080`, Web on `:3001`.

### Data stores
- Local: SQLite database file (default `meta_dj.local.sqlite`).
- Server: Postgres for metadata, S3-compatible object storage for blobs.

### Key workflows
- Import/watch/search via `packages/core/src/cli.js`.
- Analyze via JS or Rust analyzer; results written to SQLite `analysis` table.
- Sync change journal to API `/v1/sync/changes` when desired.
- Export playlists to M3U/M3U8 or Rekordbox XML.


