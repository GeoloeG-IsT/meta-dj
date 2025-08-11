package main

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type PgChangeStore struct {
	pool *pgx.Conn
}

func NewPgChangeStore(ctx context.Context, dsn string) (*PgChangeStore, error) {
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}
	s := &PgChangeStore{pool: conn}
	if err := s.init(ctx); err != nil {
		conn.Close(ctx)
		return nil, err
	}
	return s, nil
}

func (s *PgChangeStore) init(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS sync_changes (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value_hash TEXT NOT NULL,
  device_id TEXT NOT NULL,
  lamport_clock BIGINT NOT NULL,
  vector_clock TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_changes_ts ON sync_changes(ts);
`)
	return err
}

func (s *PgChangeStore) Append(ctx context.Context, changes []Change) (int, error) {
	now := time.Now().UTC()
	batch := &pgx.Batch{}
	for _, c := range changes {
		t := now
		if c.TS != "" {
			if tt, err := time.Parse(time.RFC3339, c.TS); err == nil {
				t = tt
			}
		}
		batch.Queue(`INSERT INTO sync_changes(entity_type, entity_id, field, value_hash, device_id, lamport_clock, vector_clock, ts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			c.EntityType, c.EntityID, c.Field, c.ValueHash, c.DeviceID, c.LamportClock, c.VectorClock, t)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range changes {
		if _, err := br.Exec(); err != nil {
			return 0, err
		}
	}
	return len(changes), nil
}

func (s *PgChangeStore) Since(ctx context.Context, since string) ([]Change, error) {
	var rows pgx.Rows
	var err error
	if since == "" {
		rows, err = s.pool.Query(ctx, `SELECT entity_type, entity_id, field, value_hash, device_id, lamport_clock, vector_clock, to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM sync_changes ORDER BY ts`)
	} else {
		rows, err = s.pool.Query(ctx, `SELECT entity_type, entity_id, field, value_hash, device_id, lamport_clock, vector_clock, to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM sync_changes WHERE ts >= $1 ORDER BY ts`, since)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Change{}
	for rows.Next() {
		var c Change
		if err := rows.Scan(&c.EntityType, &c.EntityID, &c.Field, &c.ValueHash, &c.DeviceID, &c.LamportClock, &c.VectorClock, &c.TS); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
