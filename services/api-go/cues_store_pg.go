package main

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type CueRow struct {
	ID         string  `json:"id"`
	TrackID    string  `json:"track_id"`
	PositionMs int64   `json:"position_ms"`
	Color      *string `json:"color,omitempty"`
	Label      *string `json:"label,omitempty"`
	Type       string  `json:"type"`
}

type PgCueStore struct{ conn *pgx.Conn }

func NewPgCueStore(ctx context.Context, dsn string) (*PgCueStore, error) {
	c, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}
	s := &PgCueStore{conn: c}
	if err := s.init(ctx); err != nil {
		c.Close(ctx)
		return nil, err
	}
	return s, nil
}

func (s *PgCueStore) init(ctx context.Context) error {
	_, err := s.conn.Exec(ctx, `
CREATE TABLE IF NOT EXISTS cues (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  position_ms BIGINT NOT NULL,
  color TEXT,
  label TEXT,
  type TEXT NOT NULL DEFAULT 'HOT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cues_track ON cues(track_id);
`)
	return err
}

func (s *PgCueStore) ListByTrack(ctx context.Context, trackID string) ([]CueRow, error) {
	rows, err := s.conn.Query(ctx, `SELECT id, track_id, position_ms, color, label, type FROM cues WHERE track_id=$1 ORDER BY position_ms`, trackID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CueRow{}
	for rows.Next() {
		var r CueRow
		if err := rows.Scan(&r.ID, &r.TrackID, &r.PositionMs, &r.Color, &r.Label, &r.Type); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *PgCueStore) Upsert(ctx context.Context, cue CueRow) error {
	_, err := s.conn.Exec(ctx, `INSERT INTO cues (id, track_id, position_ms, color, label, type, created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (id) DO UPDATE SET position_ms=EXCLUDED.position_ms, color=EXCLUDED.color, label=EXCLUDED.label, type=EXCLUDED.type`,
		cue.ID, cue.TrackID, cue.PositionMs, cue.Color, cue.Label, cue.Type, time.Now().UTC())
	return err
}

func (s *PgCueStore) Delete(ctx context.Context, id string) error {
	_, err := s.conn.Exec(ctx, `DELETE FROM cues WHERE id=$1`, id)
	return err
}
