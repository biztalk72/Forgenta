// Artifact-Svc 진입점 - 멀티모달 OutputArtifact 저장/조회, MinIO 연동 (PRD v2 §2.3 [6])
package main

import (
	"context"
	"net/http"

	"github.com/forgenta/artifact-svc/internal/config"
	"github.com/forgenta/artifact-svc/internal/server"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/logging"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const version = "0.1.0"

func main() {
	cfg := config.Load()
	log := logging.New("artifact-svc", version)
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("db_connect_failed", "err", err)
		return
	}
	defer pool.Close()

	mc, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Error("minio_init_failed", "err", err)
		return
	}
	// 버킷 보장 (idempotent)
	if exists, _ := mc.BucketExists(ctx, cfg.Bucket); !exists {
		if err := mc.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			log.Error("make_bucket_failed", "err", err)
		}
	}

	srv := &server.Server{Pool: pool, Minio: mc, Bucket: cfg.Bucket}
	mux := http.NewServeMux()
	health.Handler{
		Service: "artifact-svc", Version: version,
		Checks: map[string]health.Check{
			"database": pool.Ping,
			"minio": func(c context.Context) error {
				_, e := mc.BucketExists(c, cfg.Bucket)
				return e
			},
		},
	}.Register(mux)
	srv.Routes(mux)

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Error("server_failed", "err", err)
	}
}
