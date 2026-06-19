// 환경변수 기반 Governance-Svc 설정
package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
}

func Load() Config {
	return Config{
		Port:        env("GOVERNANCE_SVC_PORT", "8005"),
		DatabaseURL: env("DATABASE_URL", "postgres://forgenta:forgenta@localhost:5432/forgenta?sslmode=disable"),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
