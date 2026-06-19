# CLAUDE.md — Forgenta Build Guide (Loop Harness)
> AI 코딩 어시스턴트(Claude Code 등)가 이 파일을 읽고
> Forgenta 전체를 빌드·테스트·운용할 수 있도록 작성된
> 단일 진실 소스(Single Source of Truth) 가이드.
> **이 파일을 먼저 읽고, 다른 어떤 파일보다 우선 따를 것.**

---

## 0. 프로젝트 한 줄 정의

> Forgenta는 사용자의 입력(프롬프트 및 멀티모달 입력)을 해석해
> 반복 가능한 자동화 워크플로우와 멀티모달 결과를 만들어내고,
> 이를 에이전트/앱으로 카탈로그화·재사용·거버넌스할 수 있는
> 하이브리드 에이전틱 AI 플랫폼이다.

---

## 1. 빌드 전 필수 확인 (Pre-flight Checklist)

```bash
# 아래 명령을 순서대로 실행해서 모두 통과해야 빌드 시작 가능
command -v docker   || echo "MISSING: Docker Desktop or OrbStack"
command -v k3d      || echo "MISSING: k3d (brew install k3d)"
command -v helm     || echo "MISSING: helm (brew install helm)"
command -v kubectl  || echo "MISSING: kubectl (brew install kubectl)"
command -v ollama   || echo "MISSING: ollama (brew install ollama)"
command -v go       || echo "MISSING: go 1.22+ (brew install go)"
command -v python3  || echo "MISSING: python 3.12+ (brew install python)"
command -v node     || echo "MISSING: node 20+ (brew install node)"
```

**Mac 최소 사양:**
- Apple Silicon M2/M3/M4 (ARM64)
- RAM 32GB 이상 (64GB 권장)
- 여유 디스크 100GB 이상

---

## 2. 레포지토리 구조
forgenta/
├── CLAUDE.md ← 지금 이 파일 (AI 빌드 가이드)
├── DESIGN.md ← UI/UX 설계 문서
├── ARCHITECTURE.md ← 시스템 아키텍처 문서
├── PRD.md ← 제품 요구사항 문서
├── ROADMAP.md ← 마일스톤 및 스프린트 계획
├── COPYRIGHT ← 라이선스 및 저작권
├── .env.example ← 환경변수 템플릿
│
├── infra/ ← 인프라 (k3d + Helm)
│ ├── k3d/
│ │ └── cluster.yaml
│ ├── helm/
│ │ ├── forgenta-infra/ (PostgreSQL, Redis, Qdrant, MinIO)
│ │ ├── forgenta-core/ (핵심 서비스)
│ │ └── forgenta-obs/ (Loki, Prometheus, Grafana)
│ └── scripts/
│ ├── bootstrap.sh ← 전체 클러스터 부트스트랩
│ ├── teardown.sh
│ ├── health-check.sh
│ └── pull-models.sh ← Ollama 모델 다운로드
│
├── services/
│ ├── api-gateway/ (Go)
│ ├── identity-svc/ (Go)
│ ├── orchestration-svc/ (Python + LangGraph)
│ ├── headroom-proxy/ (Go)
│ ├── catalog-svc/ (Go)
│ ├── artifact-svc/ (Go)
│ └── governance-svc/ (Go)
│
├── web/ ← Frontend (React + Vite + TypeScript)
│ └── src/
│
├── db/
│ └── migrations/ ← golang-migrate SQL 파일
│
└── docs/
├── adr/ ← Architecture Decision Records
└── runbooks/ ← 운영 런북

text

---

## 3. Loop Harness 빌드 사이클

**Loop Harness**는 Claude Code가 반복적으로 돌리는 빌드-테스트-검증 루프입니다.
각 루프는 독립적으로 실행 가능하며, 실패 시 이전 상태로 rollback합니다.
┌─────────────────────────────────────────────────────┐
│ LOOP HARNESS │
│ │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │WRITE │──▶│BUILD │──▶│ TEST │──▶│VERIFY│ │
│ │ CODE │ │ │ │ │ │ │ │
│ └──────┘ └──────┘ └──────┘ └──┬───┘ │
│ ▲ │ │
│ └───────────────────────────────┘ │
│ 실패 시 WRITE로 돌아감 │
└─────────────────────────────────────────────────────┘

text

### Loop 1: 인프라 (Infrastructure)
```bash
# 실행 순서
bash infra/scripts/bootstrap.sh          # 클러스터 + 서비스 배포
bash infra/scripts/health-check.sh       # 전체 헬스 확인
# 검증 기준: 모든 Pod가 Running, 모든 헬스 엔드포인트 200 OK
```

### Loop 2: 데이터베이스 (Database)
```bash
# 마이그레이션 실행
kubectl run migrate --rm -it \
  --namespace forgenta-infra \
  --image=migrate/migrate \
  -- -path=/migrations -database=$DATABASE_URL up
# 검증 기준: 모든 테이블 존재, 시드 데이터 확인
```

### Loop 3: 백엔드 서비스 (Backend Services)
```bash
# 각 서비스별 빌드 + 테스트
for svc in api-gateway identity-svc orchestration-svc \
           headroom-proxy catalog-svc artifact-svc governance-svc; do
  echo "=== Building $svc ==="
  cd services/$svc
  make build && make test && make docker-build
  cd ../..
done
# 검증 기준: 모든 단위 테스트 통과, 이미지 빌드 성공
```

### Loop 4: 통합 테스트 (Integration)
```bash
make integration-test
# 검증 기준:
#   - API Gateway → 각 서비스 라우팅 정상
#   - Orchestration → Ollama 호출 정상
#   - Metering → UsageEvent 기록 확인
#   - Catalog CRUD 정상
```

### Loop 5: 프론트엔드 (Frontend)
```bash
cd web
npm install && npm run build && npm run test
# 검증 기준: 빌드 성공, 컴포넌트 테스트 통과
```

### Loop 6: E2E 검증 (End-to-End)
```bash
make e2e-test
# 검증 기준:
#   - 로그인 → Dashboard → 프롬프트 입력 → 결과 수신 플로우 완료
#   - Catalog 검색 → Agent 실행 플로우 완료
#   - Admin → Usage 조회 플로우 완료
```

---

## 4. 서비스별 빌드 명령

### 4.1 Go 서비스 공통 패턴
```makefile
# 각 Go 서비스 Makefile
build:
	go build -o bin/server ./cmd/main.go

test:
	go test ./... -v -race -coverprofile=coverage.out

docker-build:
	docker build --platform linux/arm64 -t forgenta/$(SERVICE):latest .

lint:
	golangci-lint run ./...

health:
	curl -sf http://localhost:$(PORT)/health | jq .
```

### 4.2 Python 서비스 (orchestration-svc)
```makefile
install:
	pip install -e ".[dev]"

test:
	pytest tests/ -v --cov=app --cov-report=term-missing

docker-build:
	docker build --platform linux/arm64 -t forgenta/orchestration-svc:latest .

lint:
	ruff check app/ && mypy app/

health:
	curl -sf http://localhost:8001/health | jq .
```

### 4.3 Frontend (web)
```makefile
dev:
	npm run dev

build:
	npm run build

test:
	npm run test

docker-build:
	docker build --platform linux/arm64 -t forgenta/web:latest .
```

---

## 5. 환경변수 구조

```bash
# .env.example — 전체 환경변수 목록

# ── 데이터베이스 ──────────────────────────────────────────
DATABASE_URL=postgresql://forgenta:forgenta@localhost:5432/forgenta
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=forgenta
MINIO_SECRET_KEY=forgenta-secret

# ── 인증 ──────────────────────────────────────────────────
JWT_SECRET=change-me-in-production-minimum-32-chars
JWT_EXPIRY=24h
OIDC_ISSUER=https://accounts.google.com   # 선택

# ── LLM Provider API Keys ─────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...              # Claude
OPENAI_API_KEY=sk-...                     # OpenAI/Codex
GOOGLE_API_KEY=AIza...                    # Gemini
OLLAMA_HOST=http://host.k3d.internal:11434

# ── LLM 라우팅 정책 ──────────────────────────────────────
DEFAULT_PLANNER_MODEL=ollama/qwen3:14b
DEFAULT_EXECUTOR_MODEL=ollama/qwen3:8b
DEFAULT_CRITIC_MODEL=claude-3-7-sonnet   # 편향 분리용 외부
DEFAULT_SUMMARIZER_MODEL=ollama/qwen3:1.7b
DEFAULT_ROUTER_MODEL=ollama/qwen3:1.7b

# ── Headroom ─────────────────────────────────────────────
HEADROOM_PROXY_URL=http://headroom-proxy:8787
HEADROOM_ENABLED=true
HEADROOM_MODE=safe                         # safe | aggressive

# ── 서비스 포트 ──────────────────────────────────────────
API_GATEWAY_PORT=8000
IDENTITY_SVC_PORT=8001
ORCHESTRATION_SVC_PORT=8002
HEADROOM_PROXY_PORT=8787
CATALOG_SVC_PORT=8003
ARTIFACT_SVC_PORT=8004
GOVERNANCE_SVC_PORT=8005

# ── Observability ─────────────────────────────────────────
LOG_LEVEL=info                             # debug | info | warn | error
LOG_FORMAT=json                            # json | text
PROMETHEUS_ENABLED=true
LOKI_URL=http://loki:3100
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

---

## 6. 헬스 체크 엔드포인트 규격

**모든 서비스는 아래 두 엔드포인트를 반드시 구현한다:**
GET /health → liveness probe (서비스 살아있는지)
GET /health/ready → readiness probe (트래픽 받을 준비됐는지)

text

**응답 형식 (공통):**
```json
{
  "status": "ok",          // "ok" | "degraded" | "unhealthy"
  "timestamp": "2026-06-19T13:00:00Z",
  "service": "api-gateway",
  "version": "0.1.0",
  "checks": {
    "database":     "ok",
    "redis":        "ok",
    "orchestration":"ok",
    "ollama":       "ok"
  }
}
```

---

## 7. 로그 구조 규격

**모든 서비스는 구조화 JSON 로그를 stdout으로 출력한다:**

```json
{
  "ts":           "2026-06-19T13:00:00.123Z",
  "level":        "info",
  "service":      "orchestration-svc",
  "version":      "0.1.0",
  "request_id":   "uuid-v4",
  "workspace_id": "uuid-v4",
  "user_id":      "uuid-v4",
  "agent_id":     "uuid-v4",
  "msg":          "llm_call_complete",
  "provider":     "ollama",
  "model":        "qwen3:14b",
  "prompt_tokens":     512,
  "completion_tokens": 128,
  "original_tokens":   1543,
  "compressed_tokens": 512,
  "compression_ratio": 0.67,
  "latency_ms":        1234,
  "success":           true
}
```

---

## 8. 오류 처리 원칙

1. **모든 오류는 로그에 기록한다** (request_id 포함 필수)
2. **LLM 호출 실패 시 fallback chain을 따른다**
   - primary → secondary → tertiary → error response
3. **MCP 도구 실패는 전체 그래프를 멈추지 않는다** (fault-tolerant node)
4. **DB 연결 실패는 즉시 /health를 degraded로 전환한다**
5. **사용자에게 노출되는 오류 메시지는 절대

