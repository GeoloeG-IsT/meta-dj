-- Add raw tag fields to preserve original metadata alongside normalized values
PRAGMA foreign_keys = ON;

ALTER TABLE tracks ADD COLUMN tag_bpm_raw REAL;
ALTER TABLE tracks ADD COLUMN tag_key_raw TEXT;

-- Backfill raw from existing normalized if raw is empty (one-time best effort)
UPDATE tracks SET tag_bpm_raw = tag_bpm WHERE tag_bpm_raw IS NULL AND tag_bpm IS NOT NULL;
UPDATE tracks SET tag_key_raw = tag_key WHERE tag_key_raw IS NULL AND tag_key IS NOT NULL;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0003_normalize_tags');


