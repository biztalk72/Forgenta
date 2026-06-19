// 환경변수 기반 API Gateway 설정 로더
package config

import "os"

type Config struct {
	Port        string
	JWTSecret   string
	IdentityURL string
}

func Load() Config {
	return Config{
		Port:        env("API_GATEWAY_PORT", "8000"),
		JWTSecret:   env("JWT_SECRET", "change-me-in-production-minimum-32-chars"),
		IdentityURL: env("IDENTITY_URL", "http://localhost:8001"),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
