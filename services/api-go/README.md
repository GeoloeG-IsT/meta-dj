## API (Go)

Minimal HTTP API scaffold.

### Run locally

```bash
cd services/api-go
go mod tidy
# ffmpeg is required for waveform generation endpoints
# Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y ffmpeg
# macOS (Homebrew): brew install ffmpeg
go run .
# curl http://localhost:8080/health -> ok
```

### Docker

```bash
docker compose up --build api
```

The API container installs `ffmpeg` so waveform generation works out of the box.

### Env

- `DATABASE_URL`: Postgres connection string
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`


