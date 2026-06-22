// 설정 로딩 — env 우선, 기본값 fallback.
package config

import "os"

type Config struct {
	Port       string
	RoutesPath string // ConfigMap에서 마운트되는 라우팅 테이블 YAML
}

func Load() Config {
	return Config{
		Port:       getenv("PORT", "8800"),
		RoutesPath: getenv("ROUTES_PATH", "/etc/inference-gateway/routes.yaml"),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
