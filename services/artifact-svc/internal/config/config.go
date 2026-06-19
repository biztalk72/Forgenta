// 환경변수 기반 Artifact-Svc 설정
package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	Bucket         string
}

func Load() Config {
	return Config{
		Port:           env("ARTIFACT_SVC_PORT", "8004"),
		DatabaseURL:    env("DATABASE_URL", "postgres://forgenta:forgenta@localhost:5432/forgenta?sslmode=disable"),
		MinioEndpoint:  env("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey: env("MINIO_ACCESS_KEY", "forgenta"),
		MinioSecretKey: env("MINIO_SECRET_KEY", "forgenta-secret"),
		Bucket:         env("MINIO_BUCKET", "artifacts"),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
