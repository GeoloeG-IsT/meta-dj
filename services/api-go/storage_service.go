package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type StorageService struct{ store *SupabaseStorage }

func NewStorageService() *StorageService {
	return &StorageService{store: NewSupabaseStorage()}
}

func (s *StorageService) ProtectedRoutes(r chi.Router) {
	r.Post("/sign", s.handleSign)
	r.Post("/upload", s.handleUpload)
}

func (s *StorageService) handleSign(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path      string `json:"path"`
		ExpiresIn int    `json:"expiresIn"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.ExpiresIn <= 0 {
		body.ExpiresIn = 3600
	}
	url, err := s.store.SignURL(r.Context(), body.Path, body.ExpiresIn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"url": url})
}

func (s *StorageService) handleUpload(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path        string `json:"path"`
		Data        string `json:"dataBase64"`
		ContentType string `json:"contentType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" || body.Data == "" {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	b, err := base64.StdEncoding.DecodeString(body.Data)
	if err != nil {
		http.Error(w, "invalid base64", http.StatusBadRequest)
		return
	}
	if err := s.store.Upload(context.Background(), body.Path, b, body.ContentType); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
