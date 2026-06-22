// Workflow-Svc 진입점 - 워크플로우 카탈로그/런 기록 (PRD v3 §7, catalog-svc 패턴 계승)
package main

import (
	"context"
	"net/http"

	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/logging"
	"github.com/forgenta/workflow-svc/internal/config"
	"github.com/forgenta/workflow-svc/internal/server"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "0.1.0"

func main() {
	cfg := config.Load()
	log := logging.New("workflow-svc", version)

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Error("db_connect_failed", "err", err)
		return
	}
	defer pool.Close()

	srv := &server.Server{Pool: pool}
	mux := http.NewServeMux()
	health.Handler{
		Service: "workflow-svc", Version: version,
		Checks: map[string]health.Check{"database": pool.Ping},
	}.Register(mux)
	srv.Routes(mux)

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Error("server_failed", "err", err)
	}
}
