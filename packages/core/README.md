## Core Library

Shared domain logic: schema, migrations, library operations, rules engine, and search.

### Quickstart

Prereqs: SQLite3, Node.js 20+.

- Migrate local DB:
  
  ```bash
  bash scripts/migrate-local.sh meta_dj.local.sqlite
  ```

- Import a folder of audio files:
  
  ```bash
  node packages/core/src/cli.js import /path/to/music
  ```

- Search via FTS5:
  
  ```bash
  node packages/core/src/cli.js search 'track*'
  ```

- Analyze tracks (auto-detects Rust analyzer if installed, else JS placeholder). Force with `DJ_ANALYZER=rust|js`:
  
  ```bash
  # Auto
  node packages/core/src/cli.js analyze
  # Force Rust
  DJ_ANALYZER=rust node packages/core/src/cli.js analyze
  ```

- Auto-generate cues/loops:
  
  ```bash
  node packages/core/src/cli.js autocue
  ```

- Cue editor:
  
  ```bash
  node packages/core/src/cli.js cue list <trackId>
  node packages/core/src/cli.js cue add <trackId> <positionMs> [label] [color] [type]
  node packages/core/src/cli.js cue rm <cueId>
  ```

- Loop editor:
  
  ```bash
  node packages/core/src/cli.js loop list <trackId>
  node packages/core/src/cli.js loop add <trackId> <startMs> <lengthBeats> [label] [color]
  node packages/core/src/cli.js loop rm <loopId>
  ```

- Playlists:
  
  ```bash
  # Static
  pid=$(node packages/core/src/cli.js playlist create 'My Crate')
  node packages/core/src/cli.js playlist add "$pid" <trackId>
  node packages/core/src/cli.js playlist tracks "$pid"
  
  # Smart (JSON rules)
  rules='{"fts":"track*","bpmMin":60,"bpmMax":200}'
  spid=$(node packages/core/src/cli.js playlist create-smart 'Smart Crate' "$rules")
  node packages/core/src/cli.js playlist smart-eval "$spid"
  ```

### Export

- M3U8 export:

```bash
node packages/core/src/cli.js export m3u <playlistId> [outDir]
```

- Rekordbox XML export (simplified):

```bash
node packages/core/src/cli.js export rekordbox-xml <playlistId> [outFile]
```



