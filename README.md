## Meta DJ

Local-first DJ library platform with offline-first core, high-performance analysis, and optional cloud sync. This monorepo contains a Next.js web app, a Go API, core CLI tooling with SQLite, and analyzer components (JS and Rust).

Refer to `SYSTEM-SPECIFICATIONS.md` for the full system-level spec and `WORKFLOW.md` for contribution rules.

### Contents
- Overview
- Prerequisites
- Quickstart (Docker)
- Quickstart (Local tooling)
- Environment variables
- Configuration files
- Development scripts and common tasks
- Testing & linting
- Security notes
- References

### Overview
- **Web app**: `apps/web` (Next.js 15) — UI for library management. Talks to the API.
- **API**: `services/api-go` (Go 1.23) — health, sync endpoints, Postgres + S3-compatible storage.
- **Core CLI**: `packages/core` (Node.js) — local SQLite library import/search/analysis/export/sync.
- **Analyzers**: `packages/analyzer` (JS placeholder) and `packages/analyzer-rs` (Rust binary).
- **Infra & scripts**: `infra/`, `scripts/`, and `docker-compose.yml` for local orchestration.

## Prerequisites
- Node.js 22+ and npm
- Go 1.23+
- Docker and Docker Compose v2
- SQLite3 CLI (for local DB migration)
- Optional: Rust toolchain (for high-performance analyzer)
- make (toolchain)

### Install Rust analyzer (optional)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install --path packages/analyzer-rs --force
```

## Quickstart (Docker)
Runs Postgres, MinIO, API, and Web.

```bash
docker compose up --build
```

- Web: `http://localhost:3001`
- API: `http://localhost:8080/health` → returns `ok`
- Postgres: `localhost:5432` (user: `meta`, password: `meta`, db: `meta_dj`)
- MinIO: S3 API at `http://localhost:9000`, console at `http://localhost:9001` (user: `meta`, password: `meta12345`) — dev only

To run just one service:
```bash
docker compose up --build api
docker compose up --build web
```

## Quickstart (Local tooling)
Local-first flow with the core CLI + SQLite. Ideal for offline library work.

1) Apply local DB migrations:
```bash
bash scripts/migrate-local.sh meta_dj.local.sqlite
```

2) Import your music folder (recursively scans supported audio file types):
```bash
node packages/core/src/cli.js import /path/to/music
# node packages/core/src/cli.js import /mnt/c/Users/pasca/Music/beatport_tracks_2025-08
```

3) Search via FTS5:
```bash
node packages/core/src/cli.js search 'track*'
```

4) Analyze tracks (auto-detects Rust analyzer if installed; override with `DJ_ANALYZER`):
```bash
node packages/core/src/cli.js analyze
DJ_ANALYZER=rust node packages/core/src/cli.js analyze
DJ_ANALYZER=js node packages/core/src/cli.js analyze
```

5) Auto-generate cues/loops and manage playlists:
```bash
node packages/core/src/cli.js autocue
node packages/core/src/cli.js playlist create 'My Crate'
```

6) Export playlists:
```bash
node packages/core/src/cli.js export m3u <playlistId> [outDir]
node packages/core/src/cli.js export rekordbox-xml <playlistId> [outFile]
```

7) Optional: Sync change journal with the API (if running `services/api-go`):
```bash
# Push local change_journal rows since a timestamp
SYNC_SINCE='1970-01-01T00:00:00Z' node packages/core/src/cli.js sync push http://localhost:8080

# Pull server changes since a timestamp
SYNC_SINCE='1970-01-01T00:00:00Z' node packages/core/src/cli.js sync pull http://localhost:8080
```

### Verify
- `sqlite3 meta_dj.local.sqlite '.tables'` shows core tables (e.g., `tracks`, `analysis`, `playlists`).
- `curl http://localhost:8080/health` returns `ok` when the API is up.
- Web UI loads at `http://localhost:3001` and can reach the API.

## Environment variables

### Using .env
- Copy `env.example` to `.env` and customize values.
- Docker Compose reads `.env` automatically. You can also export env vars in your shell.

### Global/local
- `DJ_DB_PATH` (optional): path to local SQLite DB. Default: `./meta_dj.local.sqlite`.
- `DJ_DEVICE_ID` (optional): stable device identifier for change journal entries. Default: `local-device`.
- `DJ_ANALYZER` (optional): `auto` (default) | `rust` | `js`.
- `SYNC_API_BASE` (optional): base URL for sync commands. Default: `http://localhost:8080`.
- `SYNC_SINCE` (optional): RFC3339 cursor for sync.

### API service (`services/api-go`)
- `DATABASE_URL` (required when using Postgres): e.g., `postgres://meta:meta@localhost:5432/meta_dj?sslmode=disable`.
- `STORAGE_ENDPOINT` (optional for S3-compatible storage): e.g., `http://localhost:9000`.
- `STORAGE_BUCKET` (optional): e.g., `meta-dj`.
- `STORAGE_ACCESS_KEY_ID` (optional): S3 access key.
- `STORAGE_SECRET_ACCESS_KEY` (optional): S3 secret key.
- `JWT_SECRET` (optional): when set, enables Bearer JWT auth middleware.

Defaults for local development are configured in `docker-compose.yml` (Postgres, MinIO, API base URL). Review that file and override via environment or a `.env` file as needed. Do not reuse dev defaults in production.

### Web app (`apps/web`)
- `NEXT_PUBLIC_API_BASE_URL` (required): base URL of the API for the browser. Default in compose: `http://localhost:8080`.

## Configuration files
- `docker-compose.yml`: local orchestration (Postgres, MinIO, API, Web) with healthchecks.
- `services/api-go/Dockerfile`: multi-stage Go build to `:8080`.
- `apps/web/Dockerfile`: multi-stage Next.js build; serves on `:3001`.
- `apps/web/next.config.js`, `apps/web/tsconfig.json`, `apps/web/.eslintrc.json`.
- `packages/core/migrations/*`: SQLite schema migrations.
- `scripts/migrate-local.sh`: applies migrations to a local SQLite DB.
- `.prettierrc.json`: formatting.

## Development

### Run API locally (without Docker)
```bash
cd services/api-go
go mod tidy
DATABASE_URL='postgres://meta:meta@localhost:5432/meta_dj?sslmode=disable' \
STORAGE_ENDPOINT='http://localhost:9000' \
STORAGE_BUCKET='meta-dj' \
STORAGE_ACCESS_KEY_ID='<MINIO_ACCESS_KEY>' \
STORAGE_SECRET_ACCESS_KEY='<MINIO_SECRET>' \
go run .
# curl http://localhost:8080/health
```

### Run Web locally (without Docker)
```bash
cd apps/web
npm install
NEXT_PUBLIC_API_BASE_URL='http://localhost:8080' npm run dev
```

### Core CLI common tasks
```bash
# Import, watch, search
node packages/core/src/cli.js import /path/to/music
node packages/core/src/cli.js watch /path/to/music
node packages/core/src/cli.js search 'artist*'

# Cues/loops and playlists
node packages/core/src/cli.js autocue
node packages/core/src/cli.js cue list <trackId>
node packages/core/src/cli.js loop add <trackId> <startMs> <lengthBeats>
node packages/core/src/cli.js playlist list

# Exports
node packages/core/src/cli.js export m3u <playlistId> ./out
node packages/core/src/cli.js export rekordbox-xml <playlistId> ./export.xml
```

## Testing & linting
- Root tests (Node test runner):
```bash
npm test
```
- Web lint:
```bash
cd apps/web && npm run lint
```
- Rust analyzer builds in CI when present; to build locally:
```bash
cargo build -p meta-dj-analyzer-rs
```

## Security notes
- Do not commit secrets. Use environment variables or local `.env` files excluded from VCS.
- Credentials in `docker-compose.yml` are for local development only.
- See `SECURITY.md` for additional guidance.

## References
- `SYSTEM-SPECIFICATIONS.md` — product/system-level spec
- `WORKFLOW.md` — project workflow and contribution rules
- `docs/README.md` — documentation index
- `infra/` — infrastructure-as-code (placeholders)


