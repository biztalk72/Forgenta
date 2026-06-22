#!/usr/bin/env bash
# Forgenta 클러스터 부트스트랩 (v3.4) — k3s native(DGX 1차) 또는 k3d(Mac 베이스라인).
#
# DGX Spark 호스트(aarch64 + GB10) 자동 감지 시 k3s native 사용 권장 — k3d agent는 Alpine/musl 기반이라
# glibc-only nvidia-container-runtime 실행 불가 (검증된 제약, PRD v3.4 §16.2). k3s native는 호스트 OS의
# nvidia 런타임을 그대로 사용.
#
# k3s native 사전 설치 필요:
#   curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
#   sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown $USER:$USER ~/.kube/config
#
# 본 스크립트는 k3s 가 이미 가동 중이면 namespace + device plugin 만 적용한다.
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

# DGX 프로필: k3s native 우선 (이미 가동 중이면 그대로 사용)
if [[ "$DGX_MODE" == "true" ]] && systemctl is-active --quiet k3s 2>/dev/null; then
  echo "=== k3s native detected (DGX 프로필) ==="
  export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
elif k3d cluster list 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$CLUSTER_NAME"; then
  echo "cluster '$CLUSTER_NAME' already exists — skipping create"
else
  echo "=== creating k3d cluster '$CLUSTER_NAME' (DGX_MODE=$DGX_MODE) ==="
  if [[ "$DGX_MODE" == "true" ]]; then
    echo "WARNING: k3d + DGX GPU 사용은 검증되지 않음 — rancher/k3s가 Alpine/musl 기반이라"
    echo "         glibc-only nvidia-container-runtime 실행 불가. k3s native 권장 (위 주석 참조)."
    k3d cluster create --gpus all \
      --env "NVIDIA_VISIBLE_DEVICES=all@all" \
      --env "NVIDIA_DRIVER_CAPABILITIES=compute,utility@all" \
      --config "$ROOT_DIR/infra/k3d/cluster.yaml"
  else
    k3d cluster create --config "$ROOT_DIR/infra/k3d/cluster.yaml"
  fi
fi

echo "=== applying namespaces ==="
kubectl apply -f "$ROOT_DIR/infra/k3d/namespaces.yaml"

if [[ "$DGX_MODE" == "true" ]]; then
  echo "=== installing RuntimeClass nvidia ==="
  kubectl apply -f - <<EOF
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: nvidia
handler: nvidia
EOF

  echo "=== installing NVIDIA device plugin v0.17.4 ==="
  kubectl apply -f "$ROOT_DIR/infra/k3d/nvidia-device-plugin.yaml"
  echo "=== waiting for device plugin readiness ==="
  kubectl -n kube-system rollout status ds/nvidia-device-plugin-daemonset --timeout=120s || true
  echo "=== nvidia.com/gpu allocatable on nodes ==="
  kubectl get nodes -o custom-columns=NAME:.metadata.name,GPU:'.status.allocatable.nvidia\.com/gpu'
fi

echo "=== namespaces ==="
kubectl get namespaces | grep forgenta
