// API Gateway 진입점 - 단일 진입점, 라우팅/Rate Limiting/Auth Check (PRD v2 §2.3 [1])
package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/forgenta/api-gateway/internal/config"
	"github.com/forgenta/api-gateway/internal/middleware"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/logging"
)

const version = "0.1.0"

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

	mux := http.NewServeMux()
	health.Handler{Service: "api-gateway", Version: version}.Register(mux)

	// 공개 경로: 로그인
	mux.Handle("POST /api/identity/auth/login", identityProxy)
	// 보호 경로: JWT 검증 후 프록시
	mux.Handle("GET /api/identity/auth/me", middleware.Auth(cfg.JWTSecret, identityProxy))

	handler := middleware.RateLimit(20, 40, mux)

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Error("server_failed", "err", err)
	}
}
