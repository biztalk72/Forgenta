# Forgenta 루트 Makefile — 클러스터 라이프사이클 + Phase D0~D5 DGX 진입점.
SHELL := /bin/bash

.PHONY: help cluster-up cluster-down health models models-dgx migrate migrate-down images \
        deploy-infra deploy-core deploy-llm deploy-obs deploy-ui deploy-dgx \
        integration-test e2e-test verify-dgx

help: ## 사용 가능한 타깃 목록
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-16s %s\n", $$1, $$2}'

cluster-up: ## k3d 클러스터 생성 + 네임스페이스 적용 (DGX 호스트면 GPU passthrough + device plugin)
	bash infra/scripts/bootstrap.sh

cluster-down: ## k3d 클러스터 제거
	bash infra/scripts/teardown.sh

health: ## 클러스터/네임스페이스 헬스 체크
	bash infra/scripts/health-check.sh

models: ## Ollama 모델 다운로드 (Mac 베이스라인)
	bash infra/scripts/pull-models.sh

models-dgx: ## v3.4 — HF 모델 다운로드 (Planner 72B / Executor 32B / Router 1.7B / Summarizer 8B / Embed)
	bash infra/scripts/pull-models-dgx.sh

migrate: ## DB 마이그레이션 적용 (golang-migrate, in-cluster Job)
	bash infra/scripts/migrate.sh up

migrate-down: ## DB 마이그레이션 1단계 롤백
	bash infra/scripts/migrate.sh "down 1"

images: ## 9개 서비스 이미지 빌드 + k3d import (inference-gateway 포함)
	bash infra/scripts/build-images.sh

deploy-infra: ## forgenta-infra 차트 배포 (Postgres/Redis/Qdrant/MinIO)
	helm upgrade --install forgenta-infra infra/helm/forgenta-infra -n forgenta-infra --create-namespace

deploy-core: ## forgenta-core 차트 배포 (Mac 베이스라인 — default values)
	helm upgrade --install forgenta-core infra/helm/forgenta-core -n forgenta-core --create-namespace

deploy-llm: ## v3.4 — forgenta-llm 차트 배포 (vLLM + Ollama fallback, GPU 필요)
	helm upgrade --install forgenta-llm infra/helm/forgenta-llm -n forgenta-llm --create-namespace

deploy-obs: ## forgenta-obs 차트 배포 (Loki + Prometheus + Grafana + DCGM)
	helm upgrade --install forgenta-obs infra/helm/forgenta-obs -n forgenta-obs --create-namespace

deploy-ui: ## forgenta-ui 차트 배포
	helm upgrade --install forgenta-ui infra/helm/forgenta-ui -n forgenta-ui --create-namespace

deploy-dgx: ## v3.4 전체 배포 (infra → llm → core(+DGX overlay) → obs → ui)
	$(MAKE) deploy-infra
	$(MAKE) deploy-llm
	helm upgrade --install forgenta-core infra/helm/forgenta-core -n forgenta-core --create-namespace \
	  -f infra/helm/forgenta-core/values-dgx.yaml
	$(MAKE) deploy-obs
	$(MAKE) deploy-ui

integration-test: ## 게이트웨이 경유 통합 테스트 (Loop 4)
	bash infra/scripts/integration-test.sh

e2e-test: ## web(nginx) 경유 E2E 3대 플로우 (Loop 6)
	bash infra/scripts/e2e-test.sh

verify-dgx: ## v3.4 — DGX 호스트 사전점검 (GPU + 런타임 + 모델 디렉터리)
	@echo "=== nvidia-smi ===" && nvidia-smi | head -5
	@echo "=== nvidia-ctk ===" && nvidia-ctk --version
	@echo "=== docker runtime ===" && docker info 2>/dev/null | grep -E "Runtimes|Default Runtime"
	@echo "=== /var/lib/forgenta ===" && ls -la /var/lib/forgenta 2>/dev/null || echo "MISSING"
	@echo "=== gpu container ===" && timeout 30 docker run --rm --gpus all nvcr.io/nvidia/cuda:13.0.0-base-ubuntu24.04 nvidia-smi 2>&1 | head -5
