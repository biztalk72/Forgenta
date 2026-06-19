#!/usr/bin/env bash
# golang-migrate를 in-cluster Job으로 실행 (db/migrations -> ConfigMap 마운트, Loop 2)
# 사용법: migrate.sh [up|down|...]  기본값 up
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NS=forgenta-infra
ACTION="${1:-up}"
DB_URL="postgres://forgenta:forgenta@postgresql.${NS}.svc.cluster.local:5432/forgenta?sslmode=disable"

echo "=== syncing migrations to ConfigMap ==="
kubectl create configmap forgenta-migrations \
  --from-file="$ROOT_DIR/db/migrations" \
  -n "$NS" --dry-run=client -o yaml | kubectl apply -f -

echo "=== (re)creating migrate Job (action: $ACTION) ==="
kubectl delete job forgenta-migrate -n "$NS" --ignore-not-found
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: forgenta-migrate
  namespace: ${NS}
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: migrate/migrate:latest
          args: ["-path=/migrations", "-database=${DB_URL}", "${ACTION}"]
          volumeMounts:
            - name: migrations
              mountPath: /migrations
      volumes:
        - name: migrations
          configMap:
            name: forgenta-migrations
EOF

echo "=== waiting for job ==="
kubectl wait --for=condition=complete job/forgenta-migrate -n "$NS" --timeout=120s \
  || kubectl wait --for=condition=failed job/forgenta-migrate -n "$NS" --timeout=5s || true
kubectl logs job/forgenta-migrate -n "$NS"
