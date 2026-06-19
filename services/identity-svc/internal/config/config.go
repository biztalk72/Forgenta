// 환경변수 기반 Identity-Svc 설정 로더
package config

import (
	"os"
	"time"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	JWTExpiry   time.Duration
}

func Load() Config {
	expiry, err := time.ParseDuration(env("JWT_EXPIRY", "24h"))
	if err != nil {
		expiry = 24 * time.Hour
	}
	return Config{
		Port:        env("IDENTITY_SVC_PORT", "8001"),
		DatabaseURL: env("DATABASE_URL", "postgres://forgenta:forgenta@localhost:5432/forgenta?sslmode=disable"),
		JWTSecret:   env("JWT_SECRET", "change-me-in-production-minimum-32-chars"),
		JWTExpiry:   expiry,
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
