package main

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

type ImportService struct{ Store *PgTrackStore }

func NewImportService(ctx context.Context, dsn string) (*ImportService, error) {
	st, err := NewPgTrackStore(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &ImportService{Store: st}, nil
}

func (s *ImportService) Routes(r chi.Router) {
	r.Post("/scan", s.handleScan)
}

type importScanReq struct {
	Root string `json:"root"`
}
type importScanResp struct {
	Scanned  int `json:"scanned"`
	Imported int `json:"imported"`
}

var audioExts = map[string]bool{".mp3": true, ".flac": true, ".wav": true, ".aiff": true, ".aif": true, ".m4a": true, ".ogg": true}

func sha1Hex(s string) string { h := sha1.Sum([]byte(s)); return hex.EncodeToString(h[:]) }

func baseTitle(path string) string {
	name := filepath.Base(path)
	ext := filepath.Ext(name)
	return strings.TrimSuffix(name, ext)
}

func (s *ImportService) handleScan(w http.ResponseWriter, r *http.Request) {
	var req importScanReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Root) == "" {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	// Optional host→container path remap via env
	hostPrefix := os.Getenv("IMPORT_HOST_PREFIX")
	containerPrefix := os.Getenv("IMPORT_CONTAINER_PREFIX")
	root := req.Root
	if hostPrefix != "" && containerPrefix != "" && strings.HasPrefix(root, hostPrefix) {
		root = containerPrefix + strings.TrimPrefix(root, hostPrefix)
	}
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		http.Error(w, "root not found or not a directory", http.StatusBadRequest)
		return
	}
	scanned := 0
	imported := 0
	_ = filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(p))
		if !audioExts[ext] {
			return nil
		}
		scanned++
		id := sha1Hex(p)
		title := baseTitle(p)
		// upsert minimal fields
		_, execErr := s.Store.conn.Exec(r.Context(),
			`INSERT INTO tracks(id, title, file_path) VALUES($1,$2,$3)
             ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, file_path=EXCLUDED.file_path`,
			id, title, p,
		)
		if execErr == nil {
			imported++
		}
		return nil
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(importScanResp{Scanned: scanned, Imported: imported})
}
