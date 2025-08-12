package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// Minimal Supabase Storage client using REST API.
// For richer features, use a Go SDK or proxy via an Edge function; here we keep it simple.

type SupabaseStorage struct {
	baseURL string
	key     string // service role key
	bucket  string
	client  *http.Client
}

func NewSupabaseStorage() *SupabaseStorage {
	return &SupabaseStorage{
		baseURL: os.Getenv("SUPABASE_URL"),
		key:     os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		bucket:  os.Getenv("SUPABASE_STORAGE_BUCKET"),
		client:  &http.Client{},
	}
}

func (s *SupabaseStorage) Upload(ctx context.Context, path string, data []byte, contentType string) error {
	req, _ := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, s.bucket, path), bytes.NewReader(data))
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", contentType)
	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("upload failed: %s", res.Status)
	}
	return nil
}

func (s *SupabaseStorage) SignURL(ctx context.Context, path string, expiresIn int) (string, error) {
	body := map[string]any{"expiresIn": expiresIn}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", s.baseURL, s.bucket, path), bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", "application/json")
	res, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("sign failed: %s", res.Status)
	}
	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.SignedURL == "" {
		return "", fmt.Errorf("empty signed url")
	}
	// The returned signedURL is a path; prepend base
	return s.baseURL + out.SignedURL, nil
}
