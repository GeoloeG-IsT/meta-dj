## Web App

Next.js app for library management with shared core logic. Offline-first with background sync.

### Prerequisites
- Node.js 22+
- npm
- For local SQLite access in dev (better-sqlite3 build):
  - Ubuntu/Debian: `sudo apt-get install -y build-essential python3 make gcc g++ pkg-config libsqlite3-dev`
- Optional: Supabase CLI for local auth/Postgres (see below)

### Local

```bash
cd apps/web
npm install
NEXT_PUBLIC_API_BASE_URL='http://localhost:8080' npm run dev
```

Set `DJ_DB_PATH` if your SQLite DB is not at the repo root:
```bash
export DJ_DB_PATH=/absolute/path/to/meta_dj.local.sqlite
```

### Troubleshooting
- better-sqlite3 fails to install: install build tools and SQLite headers (see prerequisites), then rerun `npm install`.

### Docker

```bash
docker compose up --build web
```

### Supabase (local)
- Install CLI: `npm i -g supabase` or follow Supabase docs
- Start local stack:
```bash
supabase init
supabase start
```
- Configure env for Web:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Use Supabase Auth for sign-in; API can verify Supabase JWTs via `JWT_SECRET` if configured accordingly

How to get keys locally:
- After `supabase start`, run:
```bash
supabase status
supabase status --json | jq -r '.api'    # shows URL/ports
supabase secrets list                     # anon key via studio or config.toml
```
- Or open local Studio UI (URL printed by `supabase start`) → Project Settings → API → copy `Project URL` and `anon` key.

Deployment (examples):
- Vercel:
  - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Project → Settings → Environment Variables.
- Docker/Kubernetes:
  - Provide as envs in compose/manifests; never bake keys into images.
- Cloud (Supabase hosted):
  - From Supabase dashboard → Project Settings → API → use the public anon key and project URL.

