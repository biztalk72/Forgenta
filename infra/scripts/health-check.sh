#!/usr/bin/env bash
# Forgenta 클러스터 헬스 체크 (Phase 0: 노드/네임스페이스 수준, 서비스 체크는 이후 단계에서 확장)
set -euo pipefail

echo "=== nodes ==="
kubectl get nodes

echo "=== forgenta namespaces ==="
kubectl get ns forgenta-infra forgenta-core forgenta-obs forgenta-ui

echo "=== forgenta-infra pods ==="
kubectl get pods -n forgenta-infra
