#!/usr/bin/env bash
# 핵심 서비스 이미지 빌드 후 k3d 클러스터로 import (로컬 레지스트리 없이 배포)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

PLATFORM=linux/arm64

echo "=== build images ==="
docker build --platform $PLATFORM -f services/identity-svc/Dockerfile -t forgenta/identity-svc:latest .
docker build --platform $PLATFORM -f services/api-gateway/Dockerfile -t forgenta/api-gateway:latest .
docker build --platform $PLATFORM -f services/orchestration-svc/Dockerfile -t forgenta/orchestration-svc:latest services/orchestration-svc
docker build --platform $PLATFORM -f services/headroom-proxy/Dockerfile -t forgenta/headroom-proxy:latest .
docker build --platform $PLATFORM -f services/catalog-svc/Dockerfile -t forgenta/catalog-svc:latest .
docker build --platform $PLATFORM -f services/artifact-svc/Dockerfile -t forgenta/artifact-svc:latest .
docker build --platform $PLATFORM -f services/governance-svc/Dockerfile -t forgenta/governance-svc:latest .
docker build --platform $PLATFORM -f services/workflow-svc/Dockerfile -t forgenta/workflow-svc:latest .
docker build --platform $PLATFORM -t forgenta/web:latest web

echo "=== import into k3d ==="
k3d image import \
  forgenta/identity-svc:latest \
  forgenta/api-gateway:latest \
  forgenta/orchestration-svc:latest \
  forgenta/headroom-proxy:latest \
  forgenta/catalog-svc:latest \
  forgenta/artifact-svc:latest \
  forgenta/governance-svc:latest \
  forgenta/workflow-svc:latest \
  forgenta/web:latest \
  -c forgenta
