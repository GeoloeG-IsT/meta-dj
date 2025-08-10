-- Schema: Initial local library
PRAGMA foreign_keys = ON;

-- Migrations registry
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core entities
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  content_hash TEXT,
  title TEXT,
  album_id TEXT,
  duration_ms INTEGER,
  codec TEXT,
  bit_rate_kbps INTEGER,
  sample_rate_hz INTEGER,
  channels INTEGER,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  comments TEXT,
  color TEXT,
  rating INTEGER,
  year INTEGER,
  genre TEXT,
  CONSTRAINT uq_tracks_file_path UNIQUE(file_path),
  CONSTRAINT fk_tracks_album FOREIGN KEY (album_id) REFERENCES albums(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_artists_name UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_artists (
  track_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PRIMARY',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, artist_id, role),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artwork (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  blob_hash TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  analyzer_version TEXT NOT NULL,
  bpm REAL,
  bpm_confidence REAL,
  musical_key TEXT,
  key_confidence REAL,
  beatgrid_json TEXT,
  lufs REAL,
  peak REAL,
  waveform_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cues (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  position_ms INTEGER NOT NULL,
  color TEXT,
  label TEXT,
  type TEXT NOT NULL CHECK(type IN ('HOT','MEMORY')),
  autogen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loops (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  length_beats INTEGER NOT NULL,
  color TEXT,
  label TEXT,
  autogen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  smart_rules_json TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES playlists(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_tags_name UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS track_tags (
  track_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (track_id, tag_id),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS export_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  target TEXT NOT NULL,
  options_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value_hash TEXT,
  device_id TEXT,
  lamport_clock INTEGER,
  vector_clock TEXT,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path);
CREATE INDEX IF NOT EXISTS idx_tracks_content_hash ON tracks(content_hash);
CREATE INDEX IF NOT EXISTS idx_track_artists_track ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_track ON track_tags(track_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag ON track_tags(tag_id);

-- FTS5 contentless index for search (to be populated by app)
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
  track_id,
  title,
  artists,
  album,
  tags,
  comments,
  tokenize = 'porter'
);

-- Touch modified_at
CREATE TRIGGER IF NOT EXISTS trg_tracks_modified_at
AFTER UPDATE ON tracks
BEGIN
  UPDATE tracks SET modified_at = datetime('now') WHERE rowid = NEW.rowid;
END;

-- Migration record
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0001_init');


