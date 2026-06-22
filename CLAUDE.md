# CLAUDE.md — Forgenta Build Guide (Loop Harness)
> AI 코딩 어시스턴트(Claude Code 등)가 이 파일을 읽고
> Forgenta 전체를 빌드·테스트·운용할 수 있도록 작성된
> 단일 진실 소스(Single Source of Truth) 가이드.
> **이 파일을 먼저 읽고, 다른 어떤 파일보다 우선 따를 것.**

---

## 0-A. 현재 베이스라인 (Profile)

**v3.4 / DGX Spark가 1차 런타임.** PRD: [`docs/prd/Forgenta PRD v3.4.md`](docs/prd/Forgenta PRD v3.4.md).
- 활성 브랜치: `feat/v3.4-dgx-rebuild`
- 호스트: NVIDIA DGX Spark (GB10 / CUDA 13 / 128GB unified / ARM64 Ubuntu)
- 추론 1차: **vLLM + inference-gateway**(`forgenta-llm` namespace), 폴백 Ollama
- 신규 서비스: `services/inference-gateway` (Go, 8800)
- Phase 진행: D 시리즈(D0~D5, DGX 런타임 재배치)가 11~14(워크플로우 MVP)에 **선행**

**Mac/Ollama 베이스라인(v2.5)** 은 dev profile 로 유지(§11). 호스트가 macOS인 경우 §1~§10 기존 절차.

---

## 0. 프로젝트 한 줄 정의

> Forgenta는 사용자의 입력(프롬프트 및 멀티모달 입력)을 해석해
> 반복 가능한 자동화 워크플로우와 멀티모달 결과를 만들어내고,
> 이를 에이전트/앱으로 카탈로그화·재사용·거버넌스할 수 있으며,
> **v3.4부터는 다단계 워크플로우를 자연어로 작성·승인·핸드오프 실행**할 수 있는
> 하이브리드 에이전틱 AI 플랫폼이다.

---

## 1. 빌드 전 필수 확인 (Pre-flight Checklist)

```bash
# 공통 (모든 프로파일)
command -v docker   || echo "MISSING: docker (DGX) or Docker Desktop/OrbStack (Mac)"
command -v k3d      || echo "MISSING: k3d v5.x"
command -v helm     || echo "MISSING: helm v3"
command -v kubectl  || echo "MISSING: kubectl"
command -v go       || echo "MISSING: go 1.22+ (DGX: go 1.26 via go.work toolchain auto-fetch)"
command -v python3  || echo "MISSING: python 3.12+"
command -v node     || echo "MISSING: node 20+"

# DGX 프로필 추가 (호스트가 aarch64 + GB10)
if [[ "$(uname -m)" == "aarch64" ]] && nvidia-smi 2>/dev/null | grep -q "GB10"; then
  command -v nvidia-ctk      || echo "MISSING: nvidia-container-toolkit"
  command -v hf              || echo "MISSING: pip install --user --break-system-packages 'huggingface_hub[cli]'"
  nvidia-smi | grep -q "CUDA Version: 13" || echo "WARN: CUDA<13"
  docker info | grep -q "nvidia"          || echo "MISSING: nvidia runtime (sudo nvidia-ctk runtime configure)"
  [[ -d /var/lib/forgenta/models ]]        || echo "MISSING: /var/lib/forgenta/{models,postgres,qdrant,minio}"
fi

# Mac 프로필 (v2.5 dev)
if [[ "$(uname -s)" == "Darwin" ]]; then
  command -v ollama || echo "MISSING: ollama (brew install ollama)"
fi
```

**DGX Spark 최소 사양 (1차 베이스라인):**
- NVIDIA DGX Spark (GB10 / CUDA 13 / 128GB unified LPDDR5x)
- NVMe ≥ 200GB (모델 캐시 80GB + 영속화 + 빌드 캐시)
- 외부 도달성: hf.co, nvcr.io

**Mac 최소 사양 (dev profile):**
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
│ ├── api-gateway/        (Go, 8000)
│ ├── identity-svc/       (Go, 8001)
│ ├── orchestration-svc/  (Python + LangGraph, 8002)
│ ├── headroom-proxy/     (Go, 8787)
│ ├── catalog-svc/        (Go, 8003)
│ ├── artifact-svc/       (Go, 8004)
│ ├── governance-svc/     (Go, 8005)
│ ├── workflow-svc/       (Go, 8006 — v3 Workflow Fabric)
│ ├── inference-gateway/  (Go, 8800 — v3.4 신규: 모델→백엔드 라우팅)
│ └── shared/             (Go module: token/health/logging/httperr)
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
#   + UI 작업은 DESIGN.md 준수(§3.5): light/dark 토글, semantic token, 반응형(375/768/1024/1440),
#     모션 예산(150~320ms), WebGL은 enhancement-only, 접근성 floor(focus/keyboard/reduced-motion)
```

### Loop 6: E2E 검증 (End-to-End)
```bash
make e2e-test
# 검증 기준:
#   - 로그인 → Dashboard → 프롬프트 입력 → 결과 수신 플로우 완료
#   - Catalog 검색 → Agent 실행 플로우 완료
#   - Admin → Usage 조회 플로우 완료
```

### Loop 7: 워크플로우 수직 슬라이스 (v3 — Workflow Fabric, Phase 11~14)
```bash
# v3 MVP: 설명 → 컴파일 → 검토/승인 → 다단계 핸드오프 실행
make migrate                    # 000008 workflow 스키마 (Loop 2 재사용)
# workflow-svc 빌드/테스트(Loop 3 패턴) + orchestration compiler/runtime
make images && make deploy-core # workflow-svc(8006) 포함 배포
make integration-test           # 워크플로우 compile/run/approval 플로우 추가
# 검증 기준:
#   - NL 설명 → compile SSE가 steps≥2 유효 spec 반환
#   - 2단계 run → step_run 2건 + context handoff + done 이벤트
#   - requires_approval 단계 → approval 생성/정지 → approve 후 resume, reject 후 halt
# 상세: PLAN.md §5(v3 플랜) · checklist.md Phase 11~17 · PRD docs/prd/Forgenta PRD v3.md
```

### 3.5 UI/디자인 규칙 (DESIGN.md 준수)
> UI/UX/테마/모션/반응형/WebGL 작업은 **`DESIGN.md`를 먼저 읽고 따른다**(시각적 헌법).
> 단, **이미 존재하는 프로젝트 design system을 우선 재사용한다** — 본 레포 web은 **React + Vite + Mantine 7**이며,
> 새 시각 언어를 즉흥 생성하지 않는다. DESIGN.md의 shadcn/ui+Tailwind 편향은 **신규 React/Tailwind 프로젝트 한정**이고,
> 본 레포는 Mantine을 design system으로 채택했으므로 **DESIGN.md 원칙을 Mantine에 매핑**한다(마이그레이션 비목표, `context-notes.md` 결정 기록).
> - 테마: Mantine `colorScheme`(light/dark) + CSS 변수 semantic token(§DESIGN Theme System), 하드코딩 hex 금지.
> - 반응형: 375/768/1024/1440 검증, touch target ≥44px, hover-only 의미 금지.
> - 모션: 150~320ms, opacity/transform 우선, reduced-motion 존중.
> - WebGL: enhancement-only(핵심 업무 UI·폼·표·내비 금지), 미지원 시 폴백.
> - 접근성 floor: 대비/focus/keyboard/reduced-motion. 금지 규칙(DESIGN.md Prohibitions)은 PRD가 명시 override하지 않는 한 적용.

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
5. **사용자에게 노출되는 오류 메시지는 절대 내부 스택/시크릿/모델 키를 포함하지 않는다.**

---

## 11. v3.4 DGX 프로필 (1차 베이스라인 — superseded v2.5-dgx)

> **v3.4에서 DGX Spark가 1차 런타임으로 승격됨**. 본 §11은 v3.4 도입 전 v2.5-dgx 프로필 메모로 유지(레거시 참조).
> **현재 진실 소스: [`docs/prd/Forgenta PRD v3.4.md`](docs/prd/Forgenta PRD v3.4.md)** (§2/§3/§5/§13).
> `ARCHITECTURE.dgx.md` / `PLAN.dgx.md`는 v2.5-dgx 스냅샷 — v3.4 PRD가 흡수했으며 빌드 진행 시 v3.4 PRD 우선.

### 11.1 적용 시점 (When to use DGX profile)
- `uname -m`이 `aarch64`이고 `nvidia-smi`가 `GB10`을 보고하는 경우 → **DGX 프로필을 따른다**.
- 그 외(Mac/Linux x86 등) → 기존 §1~§10 그대로.

### 11.2 핵심 차이 (Delta vs §1~§10)
- **추론 엔진**: Ollama → **vLLM(primary) + NIM/TRT-LLM(perf path) + Ollama(fallback)**.
- **모델 티어**: qwen3:1.7/8/14b → **Qwen3-72B(Planner) / Coder-32B(Executor) / Qwen3-8B(Summarizer) / 1.7B(Router)**.
- **클러스터**: k3d → k3d + NVIDIA device plugin (GPU passthrough), 신규 namespace `forgenta-llm`.
- **컨테이너 런타임**: Docker Desktop → containerd + NVIDIA Container Toolkit.
- **신규 서비스**: `services/inference-gateway` (Go, 포트 8800) — 모델명→백엔드 라우팅, OpenAI 호환 SSE.
- **로그/메트릭 확장**: `backend`, `gpu_index`, `kv_cache_pct`, `ttft_ms`, DCGM 메트릭.

### 11.3 Pre-flight 오버라이드
```bash
command -v nvidia-smi && nvidia-smi | grep -q GB10 || echo "MISSING: GB10 GPU"
command -v nvidia-ctk || echo "MISSING: nvidia-container-toolkit"
command -v huggingface-cli || echo "MISSING: pip install -U 'huggingface_hub[cli]'"
# 그 외 docker/k3d/helm/kubectl/go/python3/node 요구는 §1과 동일
```

### 11.4 Loop Harness 오버라이드 요약
- Loop 1: `forgenta-llm` namespace + NVIDIA device plugin + DCGM Exporter 포함.
- Loop 3: orchestration-svc는 `INFERENCE_GATEWAY_URL`을 통해 vLLM을 호출. Ollama는 폴백.
- Loop 4: integration-test에 backend=vllm 라우팅 + fallback 시나리오 케이스 추가.
- Loop 6: e2e에 TTFT/throughput SLO 회귀 게이트 추가 (Grafana `GPU & Inference` 패널).

### 11.5 환경변수 추가
```
INFERENCE_GATEWAY_URL=http://inference-gateway.forgenta-core:8800
DEFAULT_PLANNER_MODEL=vllm/qwen3-72b-instruct-nvfp4
DEFAULT_EXECUTOR_MODEL=vllm/qwen3-coder-32b-fp8
DEFAULT_SUMMARIZER_MODEL=vllm/qwen3-8b-fp8
DEFAULT_ROUTER_MODEL=vllm/qwen3-1.7b
DEFAULT_EMBED_MODEL=vllm/bge-m3
OLLAMA_HOST=http://ollama.forgenta-llm:11434
HF_HOME=/var/lib/forgenta/models/hf
NGC_API_KEY=...        # NIM 사용 시
```

### 11.6 단계별 진입점
- 단계별 빌드/검증: `PLAN.dgx.md` Phase D0~D5(필수) + D6/D7(선택, NIM/2-DGX).
- 체크리스트: `checklist.md`에 Phase D 항목을 추가하여 진행 추적.

> **AI 어시스턴트 지침**: DGX Spark 환경에서 빌드/검증을 시작하기 전에 항상
> `ARCHITECTURE.dgx.md` → `PLAN.dgx.md` 순으로 먼저 읽고, 본 §11을 §1~§10의 오버라이드로 적용한다.


