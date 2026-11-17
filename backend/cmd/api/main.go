package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"meettask/backend/internal/config"
	"meettask/backend/internal/googleauth"
	"meettask/backend/internal/httpapi"
	"meettask/backend/internal/store"
)

func main() {
	_ = godotenv.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuration error", "error", err)
		os.Exit(1)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	db, err := store.Open(ctx, cfg.GoogleCloudProject)
	if err != nil {
		logger.Error("firestore connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	server := httpapi.New(cfg, db, logger)
	// Google sign-in is a bonus: if credentials are missing the API still runs
	// with email and password, it just reports the endpoint as unavailable.
	if verifier, err := googleauth.New(ctx, cfg.GoogleCloudProject); err != nil {
		logger.Warn("google sign-in disabled", "error", err)
	} else {
		server.Google = verifier
	}
	api := server.Handler()
	handler := withFrontend(api, "dist")
	httpServer := &http.Server{Addr: ":" + cfg.Port, Handler: handler, ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout: 5 * time.Minute, WriteTimeout: 5 * time.Minute, IdleTimeout: 90 * time.Second, MaxHeaderBytes: 1 << 20}
	go func() {
		logger.Info("MeetTask Go API started", "port", cfg.Port, "firestoreProject", cfg.GoogleCloudProject)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			cancel()
		}
	}()
	<-ctx.Done()
	shutdown, stop := context.WithTimeout(context.Background(), 15*time.Second)
	defer stop()
	_ = httpServer.Shutdown(shutdown)
}

func withFrontend(api http.Handler, dist string) http.Handler {
	files := http.FileServer(http.Dir(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			api.ServeHTTP(w, r)
			return
		}
		path := filepath.Join(dist, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dist, "index.html"))
	})
}
