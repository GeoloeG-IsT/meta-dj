package main

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type CuesService struct{ Store *PgCueStore }

func NewCuesService(ctx context.Context, dsn string) (*CuesService, error) {
	st, err := NewPgCueStore(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &CuesService{Store: st}, nil
}

func (s *CuesService) Routes(r chi.Router) {
	r.Get("/track/{trackId}", s.handleListByTrack)
}

func (s *CuesService) ProtectedRoutes(r chi.Router) {
	r.Put("/{id}", s.handleUpsert)
	r.Delete("/{id}", s.handleDelete)
}

func (s *CuesService) handleListByTrack(w http.ResponseWriter, r *http.Request) {
	tid := chi.URLParam(r, "trackId")
	rows, err := s.Store.ListByTrack(r.Context(), tid)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rows)
}

func (s *CuesService) handleUpsert(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body CueRow
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	body.ID = id
	if err := s.Store.Upsert(r.Context(), body); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *CuesService) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.Store.Delete(r.Context(), id); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
