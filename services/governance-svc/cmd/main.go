// Governance-Svc 진입점 - 승인 큐, 감사 로그, UsageEvent 계량 (PRD v2 §2.3 [7])
package main

import (
	"context"
	"net/http"

	"github.com/forgenta/governance-svc/internal/config"
	"github.com/forgenta/governance-svc/internal/server"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/logging"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "0.1.0"

func main() {
	cfg := config.Load()
	log := logging.New("governance-svc", version)

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Error("db_connect_failed", "err", err)
		return
	}
	defer pool.Close()

	srv := &server.Server{Pool: pool}
	mux := http.NewServeMux()
	health.Handler{
		Service: "governance-svc", Version: version,
		Checks: map[string]health.Check{"database": pool.Ping},
	}.Register(mux)
	srv.Routes(mux)

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Error("server_failed", "err", err)
	}
}
