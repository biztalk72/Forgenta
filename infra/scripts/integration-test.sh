#!/usr/bin/env bash
# 통합 테스트 (Loop 4) - 게이트웨이 경유 전체 파이프라인 검증
# 게이트웨이→각 서비스 라우팅 / Orchestration→Ollama / Metering UsageEvent / Catalog CRUD
set -euo pipefail

NS=forgenta-core
PORT=8000
BASE="http://localhost:${PORT}"

cleanup() { [ -n "${PF_PID:-}" ] && kill "$PF_PID" 2>/dev/null || true; }
trap cleanup EXIT

kubectl port-forward -n "$NS" svc/api-gateway ${PORT}:8000 >/dev/null 2>&1 &
PF_PID=$!

pass=0; fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  PASS $1"; pass=$((pass+1));
  else echo "  FAIL $1 (expected $2, got $3)"; fail=$((fail+1)); fi
}

TOKEN=$(curl -s --retry 30 --retry-delay 1 --retry-connrefused -X POST "$BASE/api/identity/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"admin@forgenta.local","password":"forgenta"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer $TOKEN"
[ -n "$TOKEN" ] && echo "  PASS login (token issued)" && pass=$((pass+1)) || { echo "  FAIL login"; fail=$((fail+1)); }

echo "[1] gateway → identity routing"
ME=$(curl -s "$BASE/api/identity/auth/me" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["email"])')
check "identity /auth/me" "admin@forgenta.local" "$ME"

echo "[2] usage baseline → stream → usage incremented (orchestration→Ollama + metering)"
BEFORE=$(curl -s "$BASE/api/governance/v1/usage/summary" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["events"])')
curl -s --max-time 90 -N -X POST "$BASE/api/orchestration/v1/chat/stream" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"prompt":"Reply with exactly: ok. /no_think"}' >/dev/null
AFTER=$(curl -s "$BASE/api/governance/v1/usage/summary" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["events"])')
check "UsageEvent recorded by stream" "$((BEFORE+1))" "$AFTER"

echo "[3] catalog CRUD"
AID=$(curl -s -X POST "$BASE/api/catalog/v1/agents" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"itest-agent"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
GOTNAME=$(curl -s "$BASE/api/catalog/v1/agents/$AID" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["name"])')
check "catalog create+get" "itest-agent" "$GOTNAME"
DELCODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/catalog/v1/agents/$AID" -H "$AUTH")
check "catalog delete" "204" "$DELCODE"

echo "[4] auth enforced (no token → 401)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/catalog/v1/agents")
check "unauthenticated rejected" "401" "$CODE"

echo "─────────────────────────────"
echo "integration: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
