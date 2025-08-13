package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"

	"github.com/go-chi/chi/v5"
)

type AnalysisService struct {
	Tracks  *PgTrackStore
	Storage *SupabaseStorage
}

func NewAnalysisService(ctx context.Context, dsn string) (*AnalysisService, error) {
	ts, err := NewPgTrackStore(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &AnalysisService{
		Tracks:  ts,
		Storage: NewSupabaseStorage(),
	}, nil
}

func (s *AnalysisService) Routes(r chi.Router) {
	// no public routes
}

func (s *AnalysisService) ProtectedRoutes(r chi.Router) {
	r.Post("/waveform/{id}", s.handleGenerateWaveform)
	// Compatibility endpoint: body { "trackId": "..." }
	r.Post("/reanalyze", s.handleReanalyze)
}

func (s *AnalysisService) handleGenerateWaveform(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	row, err := s.Tracks.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	path, err := s.generateAndUploadWaveform(r.Context(), row)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"path": path})
}

func (s *AnalysisService) handleReanalyze(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TrackID string `json:"trackId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TrackID == "" {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	row, err := s.Tracks.Get(r.Context(), body.TrackID)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	path, err := s.generateAndUploadWaveform(r.Context(), row)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"path": path})
}

func (s *AnalysisService) generateAndUploadWaveform(ctx context.Context, row *TrackRow) (string, error) {
	inPath := row.FilePath
	// Optional host→container remap as used in import service
	hostPrefix := os.Getenv("IMPORT_HOST_PREFIX")
	containerPrefix := os.Getenv("IMPORT_CONTAINER_PREFIX")
	if hostPrefix != "" && containerPrefix != "" && len(inPath) >= len(hostPrefix) && inPath[:len(hostPrefix)] == hostPrefix {
		inPath = containerPrefix + inPath[len(hostPrefix):]
	}

	tmpf, err := os.CreateTemp("", "wave-*.png")
	if err != nil {
		return "", fmt.Errorf("tempfile: %w", err)
	}
	tmpPath := tmpf.Name()
	tmpf.Close()
	defer os.Remove(tmpPath)

	// Requires ffmpeg available in PATH
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-y",
		"-i", inPath,
		"-filter_complex", "aformat=channel_layouts=mono,showwavespic=s=1200x200:colors=#00d1b2",
		"-frames:v", "1",
		tmpPath,
	)
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("ffmpeg failed: %w", err)
	}

	data, err := os.ReadFile(tmpPath)
	if err != nil {
		return "", fmt.Errorf("read tmp: %w", err)
	}
	path := fmt.Sprintf("waveforms/%s.png", row.ID)
	if err := s.Storage.Upload(ctx, path, data, "image/png"); err != nil {
		return "", err
	}
	return path, nil
}
