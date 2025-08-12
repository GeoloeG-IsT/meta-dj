package main

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type ChangesService struct {
	Store *PgChangeStore
}

func (s *ChangesService) Routes(r chi.Router) {
	r.Get("/changes", s.handleGet)
}

func (s *ChangesService) ProtectedRoutes(r chi.Router) {
	r.Post("/changes", s.handlePost)
}

func (s *ChangesService) handleGet(w http.ResponseWriter, r *http.Request) {
	since := r.URL.Query().Get("since")
	items, err := s.Store.Since(r.Context(), since)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (s *ChangesService) handlePost(w http.ResponseWriter, r *http.Request) {
	var payload []Change
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	n, err := s.Store.Append(r.Context(), payload)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]any{"status": "ok", "received": n})
}

func NewChangesService(ctx context.Context, dsn string) (*ChangesService, error) {
	store, err := NewPgChangeStore(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &ChangesService{Store: store}, nil
}
