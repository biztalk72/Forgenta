#!/usr/bin/env bash
# 통합 테스트 (Loop 4) - 게이트웨이 경유 전체 파이프라인 검증
# 게이트웨이→각 서비스 라우팅 / Orchestration→Ollama / Metering UsageEvent / Catalog CRUD
set -euo pipefail

NS=forgenta-core
LPORT=18080   # 로컬 포워드 포트 (8000은 Docker가 점유할 수 있어 회피)
BASE="http://localhost:${LPORT}"

cleanup() { [ -n "${PF_PID:-}" ] && kill "$PF_PID" 2>/dev/null || true; }
trap cleanup EXIT

kubectl port-forward -n "$NS" svc/api-gateway ${LPORT}:8000 >/dev/null 2>&1 &
PF_PID=$!

# 포트포워드가 완전히 준비될 때까지 /health 200을 폴링 (connection reset 레이스 방지)
ready=0
for _ in $(seq 1 30); do
  if curl -sf "$BASE/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || { echo "  FAIL gateway not reachable"; exit 1; }

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

echo "[5] inference-gateway (v3.4 — 클러스터 내부 전용, 게이트웨이 미경유)"
# Mac 베이스라인(미배포)에서는 [5] 자체 SKIP. DGX 프로필에서만 실행.
if kubectl -n "$NS" get svc inference-gateway >/dev/null 2>&1; then
  IG_LPORT=18800
  kubectl port-forward -n "$NS" svc/inference-gateway ${IG_LPORT}:8800 >/dev/null 2>&1 &
  IG_PID=$!
  for _ in $(seq 1 20); do curl -sf "http://localhost:${IG_LPORT}/health" >/dev/null 2>&1 && break; sleep 1; done

  HEALTH=$(curl -s "http://localhost:${IG_LPORT}/health" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
  check "ig /health" "ok" "$HEALTH"

  R_UNK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${IG_LPORT}/v1/chat/completions" \
    -H 'Content-Type: application/json' -d '{"model":"completely-unknown-model","messages":[{"role":"user","content":"hi"}]}')
  check "ig unknown model → 404" "404" "$R_UNK"

  R_EXT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:${IG_LPORT}/v1/chat/completions" \
    -H 'Content-Type: application/json' -d '{"model":"claude-3-7-sonnet","messages":[{"role":"user","content":"hi"}]}')
  check "ig external 모델 → 403" "403" "$R_EXT"

  MET=$(curl -s "http://localhost:${IG_LPORT}/metrics" | grep -c "^inference_gateway_route_decisions_total" || true)
  if [ "$MET" -ge 1 ]; then echo "  PASS ig metrics emitted"; pass=$((pass+1));
  else echo "  FAIL ig metrics missing"; fail=$((fail+1)); fi

  kill $IG_PID 2>/dev/null || true
else
  echo "  SKIP inference-gateway not deployed (Mac baseline)"
fi

echo "─────────────────────────────"
echo "integration: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
