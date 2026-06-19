// 환경변수 기반 Headroom-Proxy 설정
package config

import "os"

type Config struct {
	Port string
	Mode string // 기본 압축 모드 safe | aggressive
}

func Load() Config {
	return Config{
		Port: env("HEADROOM_PROXY_PORT", "8787"),
		Mode: env("HEADROOM_MODE", "safe"),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
