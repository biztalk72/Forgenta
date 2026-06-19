#!/usr/bin/env bash
# Forgenta k3d 클러스터 부트스트랩 - 클러스터 생성 후 네임스페이스 적용 (Loop 1 진입점)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLUSTER_NAME="forgenta"

if k3d cluster list 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$CLUSTER_NAME"; then
  echo "cluster '$CLUSTER_NAME' already exists - skipping create"
else
  echo "=== creating k3d cluster '$CLUSTER_NAME' ==="
  k3d cluster create --config "$ROOT_DIR/infra/k3d/cluster.yaml"
fi

echo "=== applying namespaces ==="
kubectl apply -f "$ROOT_DIR/infra/k3d/namespaces.yaml"

echo "=== namespaces ==="
kubectl get namespaces | grep forgenta
