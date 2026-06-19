#!/usr/bin/env bash
# E2E 테스트 (Loop 6) - 배포된 web(nginx)→게이트웨이 경유 3대 사용자 플로우
#  1) 로그인 → 대시보드 프롬프트 → 스트리밍 결과
#  2) 카탈로그 검색 → Clone
#  3) Admin → Usage 조회 + 승인 플로우
set -euo pipefail

NS=forgenta-ui
LPORT=18081
BASE="http://localhost:${LPORT}"

cleanup() { [ -n "${PF_PID:-}" ] && kill "$PF_PID" 2>/dev/null || true; }
trap cleanup EXIT

kubectl port-forward -n "$NS" svc/web ${LPORT}:80 >/dev/null 2>&1 &
PF_PID=$!
for _ in $(seq 1 30); do curl -sf "$BASE/" >/dev/null 2>&1 && break; sleep 1; done

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  PASS $1"; pass=$((pass+1)); else echo "  FAIL $1 (exp $2, got $3)"; fail=$((fail+1)); fi }
checkne() { if [ -n "$2" ] && [ "$2" != "$3" ]; then echo "  PASS $1"; pass=$((pass+1)); else echo "  FAIL $1"; fail=$((fail+1)); fi }

echo "[flow 0] web serves SPA"
check "index served" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"

TOKEN=$(curl -s -X POST "$BASE/api/identity/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@forgenta.local","password":"forgenta"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))')
AUTH="Authorization: Bearer $TOKEN"
checkne "login via web proxy" "$TOKEN" ""

echo "[flow 1] dashboard: prompt → streamed result"
OUT=$(curl -s --max-time 90 -N -X POST "$BASE/api/orchestration/v1/chat/stream" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"prompt":"Reply with exactly: e2e ok. /no_think"}')
echo "$OUT" | grep -q '^event: token' && { echo "  PASS streamed tokens"; pass=$((pass+1)); } || { echo "  FAIL no tokens"; fail=$((fail+1)); }
echo "$OUT" | grep -q '"success": true' && { echo "  PASS stream completed"; pass=$((pass+1)); } || { echo "  FAIL stream incomplete"; fail=$((fail+1)); }

echo "[flow 2] catalog: create → search → clone"
curl -s -X POST "$BASE/api/catalog/v1/agents" -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"e2e-src"}' >/dev/null
SRC=$(curl -s "$BASE/api/catalog/v1/agents" -H "$AUTH" | python3 -c 'import sys,json;[print(a["id"]) for a in json.load(sys.stdin) if a["name"]=="e2e-src"]' | head -1)
CLONE_NAME=$(curl -s -X POST "$BASE/api/catalog/v1/agents/$SRC/clone" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["name"])')
check "clone name" "e2e-src (copy)" "$CLONE_NAME"

echo "[flow 3] admin: usage + approval decision"
EVENTS=$(curl -s "$BASE/api/governance/v1/usage/summary" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["events"])')
[ "$EVENTS" -ge 1 ] && { echo "  PASS usage events >=1 ($EVENTS)"; pass=$((pass+1)); } || { echo "  FAIL usage events"; fail=$((fail+1)); }
APID=$(curl -s -X POST "$BASE/api/governance/v1/approvals" -H "$AUTH" -H 'Content-Type: application/json' -d '{"resource_type":"e2e"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
DEC=$(curl -s -X POST "$BASE/api/governance/v1/approvals/$APID/decide" -H "$AUTH" -H 'Content-Type: application/json' -d '{"decision":"approved"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
check "approval decided" "approved" "$DEC"

echo "─────────────────────────────"
echo "e2e: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
