// API Gateway 진입점 - 단일 진입점, 라우팅/Rate Limiting/Auth Check (PRD v2 §2.3 [1])
package main

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/forgenta/api-gateway/internal/config"
	"github.com/forgenta/api-gateway/internal/middleware"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/logging"
)

const version = "0.1.0"

// stripProxy는 prefix를 떼고 target으로 리버스 프록시하는 핸들러를 만든다.
func stripProxy(prefix, target string, log *slog.Logger) http.Handler {
	u, err := url.Parse(target)
	if err != nil {
		log.Error("bad_proxy_url", "target", target, "err", err)
		return http.NotFoundHandler()
	}
	return http.StripPrefix(prefix, httputil.NewSingleHostReverseProxy(u))
}

func main() {
	cfg := config.Load()
	log := logging.New("api-gateway", version)

	identityURL, err := url.Parse(cfg.IdentityURL)
	if err != nil {
		log.Error("bad_identity_url", "err", err)
		return
	}
	// /api/identity 프리픽스를 떼고 Identity-Svc로 프록시한다.
	identityProxy := http.StripPrefix("/api/identity", httputil.NewSingleHostReverseProxy(identityURL))

	orchestrationURL, err := url.Parse(cfg.OrchestrationURL)
	if err != nil {
		log.Error("bad_orchestration_url", "err", err)
		return
	}
	// 스트리밍(SSE) 즉시 플러시를 위해 FlushInterval = -1.
	orchRP := httputil.NewSingleHostReverseProxy(orchestrationURL)
	orchRP.FlushInterval = -1
	orchestrationProxy := http.StripPrefix("/api/orchestration", orchRP)

	mux := http.NewServeMux()
	health.Handler{Service: "api-gateway", Version: version}.Register(mux)

	// 공개 경로: 로그인
	mux.Handle("POST /api/identity/auth/login", identityProxy)
	// 보호 경로: JWT 검증 후 프록시
	mux.Handle("GET /api/identity/auth/me", middleware.Auth(cfg.JWTSecret, identityProxy))
	mux.Handle("POST /api/orchestration/v1/chat/stream", middleware.Auth(cfg.JWTSecret, orchestrationProxy))
	mux.Handle("POST /api/orchestration/v1/run", middleware.Auth(cfg.JWTSecret, orchestrationProxy))

	// Catalog/Artifact: 서브트리 전체를 JWT 보호 후 프록시 (모든 메서드)
	mux.Handle("/api/catalog/", middleware.Auth(cfg.JWTSecret, stripProxy("/api/catalog", cfg.CatalogURL, log)))
	mux.Handle("/api/artifact/", middleware.Auth(cfg.JWTSecret, stripProxy("/api/artifact", cfg.ArtifactURL, log)))
	mux.Handle("/api/governance/", middleware.Auth(cfg.JWTSecret, stripProxy("/api/governance", cfg.GovernanceURL, log)))

	handler := middleware.RateLimit(20, 40, mux)

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Error("server_failed", "err", err)
	}
}
