-- Enrich track schema with tag-derived fields and album artists relation
PRAGMA foreign_keys = ON;

-- Tracks: add simple nullable columns
ALTER TABLE tracks ADD COLUMN track_no INTEGER;
ALTER TABLE tracks ADD COLUMN track_total INTEGER;
ALTER TABLE tracks ADD COLUMN disc_no INTEGER;
ALTER TABLE tracks ADD COLUMN disc_total INTEGER;
ALTER TABLE tracks ADD COLUMN tag_bpm REAL;
ALTER TABLE tracks ADD COLUMN tag_key TEXT;

-- Album artists relation
CREATE TABLE IF NOT EXISTS album_artists (
  album_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PRIMARY',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, artist_id, role),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Migration record
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0002_tags_and_numbers');


