package main

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type Change struct {
	EntityType   string `json:"entity_type"`
	EntityID     string `json:"entity_id"`
	Field        string `json:"field"`
	ValueHash    string `json:"value_hash"`
	DeviceID     string `json:"device_id"`
	LamportClock int64  `json:"lamport_clock"`
	VectorClock  string `json:"vector_clock"`
	TS           string `json:"ts"`
}

type ChangeStore struct {
	mu      sync.RWMutex
	changes []Change
}

func (s *ChangeStore) Append(changes []Change) int {
	now := time.Now().UTC().Format(time.RFC3339)
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range changes {
		// Normalize timestamps to RFC3339
		if c.TS == "" {
			c.TS = now
		} else {
			if _, err := time.Parse(time.RFC3339, c.TS); err != nil {
				// try common "YYYY-MM-DD HH:MM:SS" format
				if t2, err2 := time.Parse("2006-01-02 15:04:05", c.TS); err2 == nil {
					c.TS = t2.UTC().Format(time.RFC3339)
				} else {
					c.TS = now
				}
			}
		}
		s.changes = append(s.changes, c)
	}
	return len(changes)
}

func (s *ChangeStore) Since(since string) []Change {
	if since == "" {
		s.mu.RLock()
		defer s.mu.RUnlock()
		// return copy
		out := make([]Change, len(s.changes))
		copy(out, s.changes)
		return out
	}
	// parse since; if invalid, return all
	t, err := time.Parse(time.RFC3339, since)
	s.mu.RLock()
	defer s.mu.RUnlock()
	if err != nil {
		out := make([]Change, len(s.changes))
		copy(out, s.changes)
		return out
	}
	out := make([]Change, 0, len(s.changes))
	for _, c := range s.changes {
		// include items with invalid timestamps by default
		if ct, err := time.Parse(time.RFC3339, c.TS); err == nil {
			if ct.Equal(t) || ct.After(t) {
				out = append(out, c)
			}
		} else {
			out = append(out, c)
		}
	}
	return out
}

var globalChanges = &ChangeStore{}

func handleGetChanges(w http.ResponseWriter, r *http.Request) {
	since := r.URL.Query().Get("since")
	changes := globalChanges.Since(since)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(changes)
}

func handlePostChanges(w http.ResponseWriter, r *http.Request) {
	var payload []Change
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	n := globalChanges.Append(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]any{"status": "ok", "received": n})
}
