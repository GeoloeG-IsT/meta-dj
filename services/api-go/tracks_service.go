package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

type TracksService struct {
	Store *PgTrackStore
}

func (s *TracksService) Routes(r chi.Router) {
	r.Get("/", s.handleList)
	r.Get("/{id}", s.handleGet)
}

// ProtectedRoutes registers mutating endpoints that should be behind auth.
func (s *TracksService) ProtectedRoutes(r chi.Router) {
	r.Put("/{id}/bpm-override", s.handlePutBpmOverride)
}

func (s *TracksService) handleList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	folder := r.URL.Query().Get("folder")
	limit := 200
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	items, err := s.Store.List(r.Context(), q, folder, limit, offset)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	fieldsParam := strings.TrimSpace(r.URL.Query().Get("fields"))
	w.Header().Set("Content-Type", "application/json")
	if fieldsParam == "" {
		json.NewEncoder(w).Encode(items)
		return
	}
	fields := strings.Split(fieldsParam, ",")
	rows := make([]map[string]any, 0, len(items))
	for _, it := range items {
		m := map[string]any{}
		for _, f := range fields {
			switch strings.TrimSpace(f) {
			case "id":
				m["id"] = it.ID
			case "title":
				m["title"] = it.Title
			case "file_path":
				m["file_path"] = it.FilePath
			case "year":
				if it.Year != nil {
					m["year"] = *it.Year
				}
			case "genre":
				if it.Genre != nil {
					m["genre"] = *it.Genre
				}
			case "duration_ms":
				if it.DurationMs != nil {
					m["duration_ms"] = *it.DurationMs
				}
			case "bpm_override":
				if it.BpmOverride != nil {
					m["bpm_override"] = *it.BpmOverride
				}
			}
		}
		rows = append(rows, m)
	}
	json.NewEncoder(w).Encode(rows)
}

func (s *TracksService) handleGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	row, err := s.Store.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(row)
}

func (s *TracksService) handlePutBpmOverride(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Bpm *float64 `json:"bpm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.Bpm == nil {
		http.Error(w, "bpm required", http.StatusBadRequest)
		return
	}
	if _, err := s.Store.conn.Exec(r.Context(), `UPDATE tracks SET bpm_override = $1 WHERE id = $2`, *body.Bpm, id); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func NewTracksService(ctx context.Context, dsn string) (*TracksService, error) {
	store, err := NewPgTrackStore(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &TracksService{Store: store}, nil
}
