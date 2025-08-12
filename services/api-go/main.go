package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Dev CORS (allow localhost)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Optional: JWT auth middleware can be added here in future.

	// Choose store: Postgres if available, else in-memory
	var getHandler http.HandlerFunc = handleGetChanges
	var postHandler http.HandlerFunc = handlePostChanges
	var tracksSvc *TracksService
	var changesSvc *ChangesService
	var cuesSvc *CuesService
	var importSvc *ImportService
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		if pgStore, err := NewPgChangeStore(context.Background(), dsn); err == nil {
			getHandler = func(w http.ResponseWriter, r *http.Request) {
				since := r.URL.Query().Get("since")
				items, err := pgStore.Since(r.Context(), since)
				if err != nil {
					http.Error(w, "error", http.StatusInternalServerError)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(items)
			}
			postHandler = func(w http.ResponseWriter, r *http.Request) {
				var payload []Change
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					http.Error(w, "invalid json", http.StatusBadRequest)
					return
				}
				n, err := pgStore.Append(r.Context(), payload)
				if err != nil {
					http.Error(w, "error", http.StatusInternalServerError)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusAccepted)
				json.NewEncoder(w).Encode(map[string]any{"status": "ok", "received": n})
			}
		}
		if tsvc, err := NewTracksService(context.Background(), dsn); err == nil {
			tracksSvc = tsvc
		}
		if csvc, err := NewChangesService(context.Background(), dsn); err == nil {
			changesSvc = csvc
		}
		if cusvc, err := NewCuesService(context.Background(), dsn); err == nil {
			cuesSvc = cusvc
		}
		if isvc, err := NewImportService(context.Background(), dsn); err == nil {
			importSvc = isvc
		}
	}

	r.Route("/v1/sync", func(sr chi.Router) {
		if changesSvc != nil {
			changesSvc.Routes(sr)
		} else {
			sr.Get("/changes", getHandler)
			sr.Post("/changes", postHandler)
		}
	})

	r.Route("/v1/tracks", func(tr chi.Router) {
		if tracksSvc != nil {
			tracksSvc.Routes(tr)
		}
	})

	r.Route("/v1/cues", func(cr chi.Router) {
		if cuesSvc != nil {
			cuesSvc.Routes(cr)
		}
	})

	r.Route("/v1/import", func(ir chi.Router) {
		if importSvc != nil {
			importSvc.Routes(ir)
		}
	})

	// Protected routes (require JWT if configured)
	r.Group(func(pr chi.Router) {
		pr.Use(maybeJWT)
		pr.Route("/v1/sync", func(sr chi.Router) {
			if changesSvc != nil {
				changesSvc.ProtectedRoutes(sr)
			}
		})
		pr.Route("/v1/tracks", func(tr chi.Router) {
			if tracksSvc != nil {
				tracksSvc.ProtectedRoutes(tr)
			}
		})
		pr.Route("/v1/cues", func(cr chi.Router) {
			if cuesSvc != nil {
				cuesSvc.ProtectedRoutes(cr)
			}
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	go func() {
		logger.Info("api listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	// Graceful shutdown on SIGTERM
	sig := make(chan os.Signal, 1)
	// signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM) // add when importing syscall
	<-sig
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
