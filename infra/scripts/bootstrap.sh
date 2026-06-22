#!/usr/bin/env bash
# Forgenta k3d 클러스터 부트스트랩 (v3.4 DGX 프로필) — GPU passthrough + 네임스페이스 + NVIDIA device plugin.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLUSTER_NAME="forgenta"

# DGX 프로필 감지: aarch64 + nvidia-smi 가 GB10 보고 → GPU 모드.
DGX_MODE="false"
if [[ "$(uname -m)" == "aarch64" ]] && command -v nvidia-smi >/dev/null 2>&1 \
   && nvidia-smi 2>/dev/null | grep -q "GB10"; then
  DGX_MODE="true"
fi

if k3d cluster list 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$CLUSTER_NAME"; then
  echo "cluster '$CLUSTER_NAME' already exists — skipping create"
else
  echo "=== creating k3d cluster '$CLUSTER_NAME' (DGX_MODE=$DGX_MODE) ==="
  if [[ "$DGX_MODE" == "true" ]]; then
    # GPU passthrough: --gpus all 를 k3d 에이전트 노드 컨테이너에 전달.
    # /var/lib/forgenta/models 호스트 디렉터리는 cluster.yaml volumes 로 마운트.
    k3d cluster create --gpus all --config "$ROOT_DIR/infra/k3d/cluster.yaml"
  else
    k3d cluster create --config "$ROOT_DIR/infra/k3d/cluster.yaml"
  fi
fi

echo "=== applying namespaces ==="
kubectl apply -f "$ROOT_DIR/infra/k3d/namespaces.yaml"

if [[ "$DGX_MODE" == "true" ]]; then
  echo "=== installing NVIDIA device plugin (DaemonSet) ==="
  kubectl apply -f "$ROOT_DIR/infra/k3d/nvidia-device-plugin.yaml"
  echo "=== waiting for device plugin readiness ==="
  kubectl -n kube-system rollout status ds/nvidia-device-plugin-daemonset --timeout=120s || true
  echo "=== nvidia.com/gpu allocatable on nodes ==="
  kubectl get nodes -o custom-columns=NAME:.metadata.name,GPU:'.status.allocatable.nvidia\.com/gpu'
fi

echo "=== namespaces ==="
kubectl get namespaces | grep forgenta
