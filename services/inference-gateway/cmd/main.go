// inference-gateway — 모델명→백엔드 라우팅 + OpenAI 호환 SSE pass-through (PRD v3.4 §2.3 [8])
// 클러스터 내부 전용 서비스 — 외부 노출 금지 (api-gateway 경유만).
package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/forgenta/inference-gateway/internal/config"
	"github.com/forgenta/inference-gateway/internal/router"
	"github.com/forgenta/inference-gateway/internal/server"
	"github.com/forgenta/shared/logging"
)

const version = "0.1.0"

func main() {
	cfg := config.Load()
	log := logging.New("inference-gateway", version)

	rt, err := router.Load(cfg.RoutesPath)
	if err != nil {
		log.Error("routes_load_failed", "path", cfg.RoutesPath, "err", err)
		os.Exit(1)
	}
	log.Info("routes_loaded", "path", cfg.RoutesPath, "count", rt.Size(), "backends", rt.BackendNames())

	srv := server.New(server.Options{
		Version: version,
		Router:  rt,
		Log:     log,
	})

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv,
		ReadHeaderTimeout: 15 * time.Second,
		// 무제한 응답 시간 (SSE 장기 스트림 허용)
		WriteTimeout: 0,
		IdleTimeout:  120 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Info("listening", "port", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server_failed", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("shutdown_initiated")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		log.Error("shutdown_error", "err", err)
	}
	log.Info("shutdown_complete")
}
