# Forgenta 루트 Makefile - 클러스터 라이프사이클과 단계별 빌드 진입점
SHELL := /bin/bash

.PHONY: help cluster-up cluster-down health models migrate migrate-down

help: ## 사용 가능한 타깃 목록
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-14s %s\n", $$1, $$2}'

cluster-up: ## k3d 클러스터 생성 + 네임스페이스 적용
	bash infra/scripts/bootstrap.sh

cluster-down: ## k3d 클러스터 제거
	bash infra/scripts/teardown.sh

health: ## 클러스터/네임스페이스 헬스 체크
	bash infra/scripts/health-check.sh

models: ## Ollama 모델 다운로드 (대용량, 수동 실행)
	bash infra/scripts/pull-models.sh

migrate: ## DB 마이그레이션 적용 (golang-migrate, in-cluster Job)
	bash infra/scripts/migrate.sh up

migrate-down: ## DB 마이그레이션 1단계 롤백
	bash infra/scripts/migrate.sh "down 1"
