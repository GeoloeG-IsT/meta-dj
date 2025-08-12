package main

import (
    "context"
    "fmt"
    "strconv"
    "strings"

    "github.com/jackc/pgx/v5"
)

type TrackRow struct {
    ID         string `json:"id"`
    Title      string `json:"title"`
    FilePath   string `json:"file_path"`
    Year       *int   `json:"year,omitempty"`
    Genre      *string `json:"genre,omitempty"`
    DurationMs *int64 `json:"duration_ms,omitempty"`
}

type PgTrackStore struct {
    conn *pgx.Conn
}

func NewPgTrackStore(ctx context.Context, dsn string) (*PgTrackStore, error) {
    c, err := pgx.Connect(ctx, dsn)
    if err != nil { return nil, err }
    s := &PgTrackStore{conn: c}
    if err := s.init(ctx); err != nil { c.Close(ctx); return nil, err }
    return s, nil
}

func (s *PgTrackStore) init(ctx context.Context) error {
    _, err := s.conn.Exec(ctx, `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT,
  file_path TEXT NOT NULL,
  year INTEGER,
  genre TEXT,
  duration_ms BIGINT
);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(file_path);
`)
    return err
}

func (s *PgTrackStore) List(ctx context.Context, q string, folder string, limit, offset int) ([]TrackRow, error) {
    where := []string{}
    args := []any{}
    param := 1
    if q != "" {
        where = append(where, fmt.Sprintf("title ILIKE '%%' || $%d || '%%'", param))
        args = append(args, q)
        param++
    }
    if folder != "" {
        where = append(where, fmt.Sprintf("file_path LIKE $%d || '%%'", param))
        args = append(args, folder)
        param++
    }
    sql := "SELECT id, title, file_path, year, genre, duration_ms FROM tracks"
    if len(where) > 0 { sql += " WHERE " + strings.Join(where, " AND ") }
    sql += " ORDER BY title LIMIT $" + strconv.Itoa(param) + " OFFSET $" + strconv.Itoa(param+1)
    args = append(args, limit, offset)
    rows, err := s.conn.Query(ctx, sql, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    out := []TrackRow{}
    for rows.Next() {
        var r TrackRow
        if err := rows.Scan(&r.ID, &r.Title, &r.FilePath, &r.Year, &r.Genre, &r.DurationMs); err != nil { return nil, err }
        out = append(out, r)
    }
    return out, rows.Err()
}

func (s *PgTrackStore) Get(ctx context.Context, id string) (*TrackRow, error) {
    row := s.conn.QueryRow(ctx, `SELECT id, title, file_path, year, genre, duration_ms FROM tracks WHERE id=$1`, id)
    var r TrackRow
    if err := row.Scan(&r.ID, &r.Title, &r.FilePath, &r.Year, &r.Genre, &r.DurationMs); err != nil { return nil, err }
    return &r, nil
}

// no-op


