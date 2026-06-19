#!/usr/bin/env bash
# Forgenta k3d 클러스터 제거
set -euo pipefail
CLUSTER_NAME="forgenta"
echo "=== deleting k3d cluster '$CLUSTER_NAME' ==="
k3d cluster delete "$CLUSTER_NAME"
