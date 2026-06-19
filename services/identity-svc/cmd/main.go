// Identity-Svc 진입점 - OIDC/JWT 인증, RBAC, 워크스페이스 컨텍스트 (PRD v2 §2.3 [2])
package main

import (
	"context"
	"net/http"

	"github.com/forgenta/identity-svc/internal/config"
	"github.com/forgenta/identity-svc/internal/server"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/logging"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "0.1.0"

func main() {
	cfg := config.Load()
	log := logging.New("identity-svc", version)

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Error("db_connect_failed", "err", err)
		return
	}
	defer pool.Close()

	srv := &server.Server{Pool: pool, Cfg: cfg, Log: log}

	mux := http.NewServeMux()
	health.Handler{
		Service: "identity-svc", Version: version,
		Checks: map[string]health.Check{"database": pool.Ping},
	}.Register(mux)
	mux.HandleFunc("POST /auth/login", srv.Login)
	mux.HandleFunc("GET /auth/me", srv.Me)

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Error("server_failed", "err", err)
	}
}
