## API (Go)

Minimal HTTP API scaffold.

### Run locally

```bash
cd services/api-go
go mod tidy
go run .
# curl http://localhost:8080/health -> ok
```

### Docker

```bash
docker compose up --build api
```

### Env

- `DATABASE_URL`: Postgres connection string
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`


