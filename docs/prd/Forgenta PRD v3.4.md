# Forgenta PRD v3.4
## Hybrid Agentic AI Platform — Agentic Operations on DGX Spark
Version: 3.4 | Status: DRAFT (DGX 빌드 go-신호 대기) | Date: 2026-06-22 | Branch: `feat/v3.4-dgx-rebuild` | Host: DGX Spark (`zgx-1aee`) | Author: CAIO/CTO

> 본 문서는 PRD v2.0(`docs/prd/Forgenta PRD v2.md`) → v3.0~v3.2(`Forgenta PRD v3.md`)를 상위 호환으로 계승·확장한다.
> v3.4는 **런타임 베이스라인을 NVIDIA DGX Spark (GB10 / CUDA 13 / 128GB unified / ARM64 Ubuntu)로 승격**하고,
> 그동안 별도 프로필 문서(`ARCHITECTURE.dgx.md` / `PLAN.dgx.md` / CLAUDE.md §11)로 분리되어 있던 DGX 항목들을
> PRD 본문으로 흡수해 **단일 진실 소스(SSOT)** 를 통일한다. 제품 정의(§1) · 도메인 모델(§3) · API 계약(§7) · 보안/거버넌스(§10) 는
> v3.2와 **계약 무변경**이다.

---

## 0-A. 변경 이력 (Changelog)

### v3.4 (from v3.2)
- **런타임 베이스라인 변경.** "MacOS + Ollama"는 격하(`fallback/experimental`), **DGX Spark + vLLM**이 1차. PRD 본문이 이를 기준으로 기술된다(§2/§3/§5).
- **신규 서비스 정식화.** `services/inference-gateway`(Go, 포트 8800)를 정식 서비스로 편입(§2.3 [8]). 모델명→백엔드(vLLM/NIM/TRT-LLM/Ollama) 라우팅 + 통일 OpenAI 호환 SSE.
- **신규 네임스페이스.** `forgenta-llm` 추가 — GPU 점유 파드 격리(§2.2). 기존 4개 namespace에 더해 총 5개.
- **추론 스택 정식화.** 1차 vLLM(NVFP4/FP8), 2차 NIM/TensorRT-LLM(perf path), 3차 Ollama(fallback)로 명시(§3).
- **모델 티어 변경.** Planner Qwen3-72B-Instruct(NVFP4) / Executor Qwen3-Coder-32B(FP8) / Critic 외부(Claude) / Summarizer Qwen3-8B(FP8) / Router Qwen3-1.7B / Embed bge-m3(§3.2).
- **관측 확장.** DCGM Exporter + Grafana `GPU & Inference` 대시보드 + `Routing & Fallbacks` 대시보드를 1급 요구로(§14). 로그/usage_event 필드에 `backend`/`gpu_index`/`kv_cache_pct`/`ttft_ms` 추가(§7.4).
- **SLO 정의.** Planner TTFT < 0.5s(72B NVFP4), Executor 32B ≥ 60 tok/s, 동시 사용자 8~16, 워크플로우 2단계 종단 2~5s(§17).
- **Phase 명명 정합.** v3 워크플로우 Phase 11~17은 그대로 유지. **선행 Phase D0~D5(DGX 런타임 재배치) 신설** — D 시리즈가 11번 시리즈에 선행한다(§13).
- **불변 항목 명시.** DB 마이그레이션 000001~000008, API 계약, JSON 로그/헬스 규격, RBAC/Audit/Approval, DESIGN.md(Mantine) — 모두 무변경(§12).

### v3.2 (from v3.1) — 계승
- 커넥터 출력형 확장: Obsidian / Gmail / Outlook. `browser` 커넥터 구현체를 Playwright MCP로 명시. 모두 기존 Connector/MCP/OAuth 프레임워크의 인스턴스.

### v3.1 (from v3.0) — 계승
- v3 플랜 markdown SSOT 동기화(`CLAUDE.md` Loop 7, `PLAN.md` §5, `checklist.md` Phase 11~17). `workflow-svc`(8006), orchestration→workflow-svc 내부 write API, 마이그레이션 `000008`(3테이블).
- Output/Export 커넥터: Google Workspace(Docs/Sheets/Slides/Drive).

---

## 0. 변경 개요 (What's New in v3.4)

v3.0~v3.2는 **Agentic Operations(Workflow Fabric)** — 자연어/시연 → 컴파일 → 검토/승인 → 다중 에이전트 핸드오프 → 학습 — 의 **설계**를 끝냈다.
v3.4는 그 위에 **하드웨어/런타임 베이스를 DGX Spark로 승격**해 다음을 가능하게 한다:

1. **로컬에서 70B~120B 클래스 모델 상주.** Planner를 클라우드(Claude/GPT)에서 로컬 Qwen3-72B로 끌어와 민감 데이터 규정 준수와 비용을 동시에 해결.
2. **워크플로우 동시 실행 8~16채널.** Mac 베이스라인(1~2 동시)에서 한 자릿수 이상 도약, 운영팀 다인 사용 가능.
3. **NVFP4/FP8 양자로 NVLink-C2C 활용.** Grace↔Blackwell 간 PCIe 우회로 단일 박스에서 70B Planner + 32B Executor + 8B/1.7B 보조를 동시 상주(≈75GB/128GB).
4. **추론 백엔드 추상화.** `inference-gateway`로 vLLM/NIM/TRT-LLM/Ollama 멀티플렉싱 → 모델 단위로 무중단 백엔드 스왑 가능.
5. **GPU/추론 관측.** DCGM + vLLM 메트릭을 Grafana SLO 게이트와 통합 → 회귀 가드(TTFT/throughput) 자동화.

v3.0~v3.2의 6대 추가 능력(워크플로우 작성/런타임/단계 승인/커넥터/학습/Output Export)은 그대로 유효하며,
**MVP 슬라이스 정의(Phase 11~14)** 도 변경 없다. DGX 작업은 그 **선행 인프라**(Phase D0~D5)로 정의된다.

---

## 1. 배경 & 영감 — Akai 분석과 갭(Gap)
v3.2 §1 그대로 계승. (Akai by Deel "Show it once. Watch it grow." 3-step 모델, Forgenta v2 자산과 v3 갭.)
DGX Spark 도입이 추가로 해결하는 갭:
- **로컬 LLM 품질 격차(Mac/Ollama 14B 한계 → DGX/vLLM 72B NVFP4)**. Critic만 클라우드, 나머지 전부 로컬 가능.
- **장기 실행 워크플로우의 비용/지연.** 단계 누적 토큰을 로컬 70B로 흡수 → 운영 비용 0에 수렴.

---

## 2. v3.4 제품 확장 정의

### 2.1 한 줄 정의 (Confirmed)
Forgenta는 사용자의 입력을 해석해 결과를 만드는 것을 넘어, **반복 가능한 다단계 운영 워크플로우를 자연어/시연으로 작성하고, 여러 에이전트가 공유 컨텍스트로 핸드오프하며 사람이 승인한 단계에 따라 종단까지 실행하고, 실행할수록 학습·개선되는** 하이브리드 에이전틱 운영 자동화 플랫폼이며,
1차 런타임 환경으로 **NVIDIA DGX Spark**(단일 박스 70B+ NVFP4 추론) 위에서 동작한다.

### 2.2 네임스페이스 구조 (5개)
- `forgenta-infra` — PostgreSQL(pgvector + TimescaleDB), Redis, Qdrant, MinIO
- `forgenta-core` — api-gateway / identity-svc / orchestration-svc / headroom-proxy / catalog-svc / artifact-svc / governance-svc / workflow-svc / **inference-gateway**
- `forgenta-llm` (**신규**) — vLLM(planner/executor/small/embed) + (선택) NIM/TRT-LLM + (폴백) Ollama. GPU 점유 파드 격리.
- `forgenta-obs` — Loki + Promtail / Prometheus / Grafana / **DCGM Exporter**
- `forgenta-ui` — web(nginx + React/Mantine 7)

### 2.3 서비스 맵 (Service Map v3.4)
v2 §2.3의 [1]~[7] 그대로 + v3 [9] workflow-svc + **신규 [8] inference-gateway**.
- [1] api-gateway (Go, 8000): 진입점, rate-limit, JWT, subtree proxy.
- [2] identity-svc (Go, 8001): OIDC/JWT/RBAC, workspace context.
- [3] orchestration-svc (Python/LangGraph, 8002): Planner/Executor/Critic/Summarizer/Router 노드 + 워크플로우 컴파일러/런타임.
- [4] headroom-proxy (Go, 8787): Kompress/SmartCrusher/CodeCompressor. **토크나이저 백엔드를 HF tokenizers로 교체**(Ollama tokenizer 의존 제거), `target_model_max_ctx` 인자 추가.
- [5] catalog-svc (Go, 8003): Agent/App/PromptTemplate CRUD + Clone/CloneLineage.
- [6] artifact-svc (Go, 8004): 멀티모달 OutputArtifact + MinIO + `external_file_ref`.
- [7] governance-svc (Go, 8005): Approval/AuditLog/UsageEvent + Alert.
- **[8] inference-gateway (Go, 8800) — 신규.** 모델명 → 백엔드 라우팅 + 통일 OpenAI 호환 SSE. 클러스터 **내부 전용**(외부 노출 금지). 책임:
  - `POST /v1/chat/completions`, `POST /v1/completions`, `POST /v1/embeddings` OpenAI 호환.
  - 라우팅 테이블(ConfigMap): `qwen3-72b-*` → vllm-planner / `qwen3-coder-32b*` → vllm-executor / `qwen3-(8b|1.7b)*` → vllm-small / `bge-*` → vllm-embed / `ollama/*` → ollama / `claude-*` → external(orchestration이 직접).
  - 백엔드 헬스 폴링(`/v1/models`), 폴백 체인 vLLM → NIM → Ollama → 502.
  - 메트릭: 백엔드별 RPS/latency/fallback rate, route decision histogram. `/metrics`(Prom).
  - SSE pass-through(`flushInterval=-1`).
- [9] workflow-svc (Go, 8006, v3): Workflow/Run/Step CRUD + 내부 write API(`/v1/runs`, `/v1/steps`).

### 2.4 코어 파이프라인 (Extended)
v2: 입력 → 해석 → 실행 → 멀티모달 결과 → 카탈로그화 → 거버넌스.
v3 추가: 작성(describe/record) → 컴파일(NL→Spec) → 검토·승인 → 실행(multi-agent handoff + shared context) → 결과/아티팩트 → 계량·감사·이상탐지 → 학습.

---

## 3. 추론 스택 (Inference Stack) — v3.4 정식화

### 3.1 1차: vLLM (default)
- OpenAI 호환 API + 토큰 SSE 기본, PagedAttention, continuous batching, LoRA 핫스왑, NVFP4/FP8 지원.
- k3d 워커 노드 GPU passthrough, Pod당 1 GPU, 가중치는 PVC(hostPath `/var/lib/forgenta/models/`)로 영속.

### 3.2 모델 카탈로그 (권장 초기 풀)

| 역할 | 모델 | 정밀도 | 메모리 | 비고 |
|---|---|---|---|---|
| Planner | Qwen3-72B-Instruct (또는 Llama-3.3-70B) | NVFP4 | ~40 GB | 다단계 reasoning |
| Executor | Qwen3-Coder-32B (또는 GPT-OSS-32B) | NVFP4/FP8 | ~18 GB | 코드/구조화 출력 |
| Critic | **외부 Claude 3.7 Sonnet** (또는 Llama-3.1-8B 로컬) | API / FP8 | API / ~6 GB | 편향 분리 — 외부 우선 |
| Router | Qwen3-1.7B | FP16 | ~3 GB | 분류·라우팅 |
| Summarizer | Qwen3-8B | FP8 | ~6 GB | 컨텍스트 압축 보조 |
| Embed | bge-m3 (vLLM-embed) 또는 nomic-embed-text-v2 | FP16 | ~2 GB | RAG 검색 |

**Unified RAM 계획:** 동시 상주 ~75 GB / 128 GB. KV cache + 동시 요청 헤드룸 30%(≈ 38 GB) 확보.

### 3.3 2차: NIM / TensorRT-LLM (perf path, optional)
- NGC에서 GB10/Blackwell 호환 NIM 컨테이너. 단일 모델당 별도 Service.
- NVFP4 엔진(.plan/.trtllm)을 `/var/lib/forgenta/models/trtllm/<name>/`에 사전 빌드.
- 모델 변경 비용 큼 → 안정화된 Planner/Executor만 승격(Phase D6).

### 3.4 3차: Ollama (fallback / 실험)
- Mac 베이스라인 자산(qwen3:1.7/8/14b) 호환 유지. CUDA 백엔드 ARM64 빌드.
- `OLLAMA_HOST=http://ollama.forgenta-llm:11434` — 폴백 체인 마지막 단계.

### 3.5 ModelRouter 정책 (orchestration-svc)
v2 §3.3 정책 그대로 + DGX 확장:
- 민감 데이터 → **로컬 전용**(vLLM/NIM/Ollama만, Critic 외부 금지 플래그).
- 품질 등급 high & budget OK → Planner 72B; 그 외 32B Executor.
- 코드 의도 감지 → Coder-32B.
- 장문(>32k context) → Qwen3-8B with sliding window + headroom 압축 선행.
- 첫 토큰 지연 > N → 더 작은 모델로 강등(latency-aware re-route).
- GPU mem pressure(DCGM `DCGM_FI_DEV_FB_USED` > 85%) → Planner 비활성, Executor only.

```bash
# v3.4 기본값 (.env / Helm values)
DEFAULT_PLANNER_MODEL=vllm/qwen3-72b-instruct-nvfp4
DEFAULT_EXECUTOR_MODEL=vllm/qwen3-coder-32b-fp8
DEFAULT_CRITIC_MODEL=claude-3-7-sonnet           # 외부 유지(편향 분리)
DEFAULT_SUMMARIZER_MODEL=vllm/qwen3-8b-fp8
DEFAULT_ROUTER_MODEL=vllm/qwen3-1.7b
DEFAULT_EMBED_MODEL=vllm/bge-m3
INFERENCE_GATEWAY_URL=http://inference-gateway.forgenta-core:8800
OLLAMA_HOST=http://ollama.forgenta-llm:11434
HF_HOME=/var/lib/forgenta/models/hf
```

---

## 4. Akai → Forgenta 기능 매핑
v3.2 §4 그대로 계승. (Show once → Workflow Compiler / Approve every step → HITL / Hand off → Workflow Runtime / Gets smarter → workflow_memory + Qdrant RAG / Any system → Connectors / Deliver to user tools → Output/Export 커넥터.)

---

## 5. 시스템 아키텍처 변경 (Architecture Delta v3.4)

### 5.1 v2 → v3 → v3.4 누적 변경
| 영역 | v2 | v3.2 | v3.4 |
|---|---|---|---|
| Host | macOS Apple Silicon | (동) | **Ubuntu (DGX OS) aarch64** |
| GPU | Apple Metal | (동) | **NVIDIA GB10 Blackwell (CUDA 13)** |
| RAM | 32~64 GB | (동) | **128 GB unified LPDDR5x** |
| 추론 엔진 | Ollama (Metal) | (동) | **vLLM (primary) + NIM/TRT-LLM (perf) + Ollama (fallback)** |
| 모델 티어 | qwen3:1.7/8/14b | (동) | **72B / 32B / 8B / 1.7B (NVFP4/FP8)** |
| Container runtime | Docker Desktop | (동) | **containerd + NVIDIA Container Toolkit** |
| 클러스터 | k3d (CPU only) | (동) | **k3d + NVIDIA device plugin (GPU passthrough)** |
| 서비스 | 7 (api/identity/orch/headroom/catalog/artifact/governance) | **+1 workflow-svc** | **+1 inference-gateway (= 9개)** |
| Namespace | 4 | (동) | **5 (+ forgenta-llm)** |
| Observability GPU | — | — | **DCGM Exporter + GPU & Inference 대시보드** |

### 5.2 단일 박스 토폴로지
```
┌──────────────────────────── DGX Spark (host) ───────────────────────────┐
│  Browser ─► nginx (web :8080 Ingress) ─► api-gateway :8000              │
│                                              │                          │
│            ┌─────────────────────────────────┼───────────────────────┐  │
│            ▼                ▼                ▼              ▼        │  │
│      identity-svc    orchestration-svc   catalog/artifact  workflow- │  │
│        :8001          :8002 (LangGraph)   :8003 :8004      svc :8006 │  │
│                          │                                            │  │
│                          ├──► headroom-proxy :8787 (HF tokenizer)     │  │
│                          │                                            │  │
│                          ├──► inference-gateway :8800 (신규)           │  │
│                          │       ├─ vLLM (Planner 72B / Executor 32B) │  │
│                          │       ├─ vLLM (Router 1.7B / Summarizer 8B)│  │
│                          │       ├─ vLLM (Embed bge-m3)               │  │
│                          │       ├─ NIM / TRT-LLM (선택, perf path)     │  │
│                          │       └─ Ollama (fallback)                 │  │
│                          │                                            │  │
│                          └──► governance-svc :8005                    │  │
│                                                                       │  │
│  Data plane: PostgreSQL(pgvector+Timescale) · Redis · Qdrant · MinIO  │  │
│  Obs plane : Loki + Promtail · Prometheus · Grafana · DCGM Exporter   │  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                       (선택) 2× 200GbE  →  2nd DGX Spark (200B 클래스)
```

### 5.3 Orchestration-Svc 확장 (v3 → v3.4)
v3.2 §5.2 그대로 + 변경점:
- **Provider 클라이언트 교체.** `providers.py`의 Ollama 직접 호출을 **OpenAI 호환 클라이언트(`INFERENCE_GATEWAY_URL`)** 로 치환. SSE pass-through 유지.
- **ModelRouter 기본값 갱신** (§3.5).
- 컴파일러/런타임 노드(v3): NL → spec, 다단계 실행, blackboard handoff — 변경 없음.

### 5.4 데이터 계층 (변경 없음)
v3.2 §5.4 + 6 그대로. 마이그레이션 000001~000007(v2) + 000008(v3 workflow MVP). 후속 000009~(connector / workflow_memory / alert)는 Phase 15~17.

### 5.5 스토리지 레이아웃 (DGX 1차 도입)
```
/var/lib/forgenta/
├── models/               # 70~80 GB 상한 (NVFP4/FP8 가중치)
│   ├── hf/               # HF_HOME (huggingface_hub 캐시)
│   ├── vllm/<repo>/<rev>/
│   ├── trtllm/<name>/<engine>.plan
│   └── ollama/
├── postgres/             # PVC backing (local-path 또는 hostPath)
├── qdrant/
├── minio/
└── grafana/loki/
```

---

## 6. 데이터 모델 (변경 없음)
v3.2 §6 그대로. MVP 마이그레이션 `000008_workflow.up.sql`은 `workflow` / `workflow_run` / `workflow_step_run` 3테이블. `connector` / `workflow_schedule` / `workflow_memory` / `alert(_rule)`는 후속.

---

## 7. API 설계 (계약 무변경 + 신규 SSE 필드)

### 7.1 게이트웨이 (변경 없음)
v3.2 §7 + v3.4 추가: `inference-gateway`는 **외부 노출 금지**(클러스터 내부 전용). 사용자 접근은 항상 `api-gateway` 경유.

### 7.2 inference-gateway 내부 API (신규)
```text
POST /v1/chat/completions      OpenAI 호환, SSE
POST /v1/completions           OpenAI 호환
POST /v1/embeddings            OpenAI 호환
GET  /v1/models                백엔드 aggregate
GET  /healthz, /readyz         vLLM/NIM/Ollama aggregate
GET  /metrics                  Prometheus
```

### 7.3 워크플로우 API (변경 없음)
v3.2 §7 그대로 — workflow-svc CRUD + orchestration compile/run/resume/cancel/export.

### 7.4 로그/usage_event 필드 확장
기존 JSON 로그(CLAUDE.md §7) 호환 + 신규 옵셔널 필드:
```jsonc
{
  "backend":      "vllm" | "nim" | "trtllm" | "ollama" | "external",
  "gpu_index":    0,
  "kv_cache_pct": 37.2,
  "ttft_ms":      210,
  "run_id":       "uuid",          // 워크플로우 런 (v3)
  "step_seq":     2                // 워크플로우 단계 (v3)
}
```
usage_event도 동일 필드 추가(`backend`/`gpu_index` 필수, 나머지 옵셔널). 폴백 시 `backend` 분기 기록 → governance에서 fallback rate 집계.

---

## 8. 워크플로우 실행 모델 (변경 없음)
v3.2 §8 그대로. 단, **단계 라우팅이 inference-gateway를 경유**한다(orchestration → ig → vLLM/Ollama). SSE 이벤트 타입 동일.

---

## 9. 연속 학습 (변경 없음)
v3.2 §9 그대로.

---

## 10. 거버넌스 · 보안 · 컴플라이언스 (변경 없음 + 강화)
v3.2 §10 그대로 + DGX 한정 추가:
- **모델 가중치 read-only PVC 마운트.** 운영 단계에서 `/var/lib/forgenta/models`는 RO.
- **inference-gateway 외부 노출 금지.** ClusterIP only, NetworkPolicy로 외부 인입 차단.
- **민감 데이터 라우팅 강제.** ig는 `X-Forgenta-Sensitive=true` 헤더를 받으면 `external` 백엔드(Claude/GPT 등)로 라우팅하지 않는다(403).
- **SELinux/AppArmor enforce, `--cap-drop ALL` + seccomp default**(운영 단계).

---

## 11. 프론트엔드 (변경 없음)
v3.2 §11 그대로 (Mantine 7, DESIGN.md, light/dark, 반응형 375/768/1024/1440, 모션 150~320ms, WebGL enhancement-only, 접근성 floor). Connectors/Workflows/Runs/Admin 페이지 신규.

---

## 12. v3.4 불변 항목 (Stays-Same Matrix)
이 항목들은 v2/v3.2 → v3.4 전환에서 **무변경**:
- DB 마이그레이션 000001~000008 — golang-migrate ARM64 컨테이너 그대로
- API 계약 (게이트웨이 라우팅, JWT, 에러 포맷)
- JSON 로그/헬스 규격 (§CLAUDE.md §6/§7) — 신규 필드는 모두 옵셔널
- RBAC / Audit / Approval 도메인
- DESIGN.md(Mantine), 5대 설계 원칙
- 카탈로그 Clone 계보, Artifact MinIO, Headroom 압축 인터페이스(`HEADROOM_ENABLED`)
- v3 워크플로우 도메인(workflow/run/step) + workflow-svc API 및 게이트웨이 라우트(`/api/workflow/`)

---

## 13. 단계별 도입 (Phasing) — v3.4 통합 로드맵

### 13.1 누적 상태
| Phase | 범위 | 상태 |
|---|---|---|
| 0~10 | v2 (infra / DB / 7 services / web / E2E) | ✅ 완료 (현재 클러스터에 가동 중) |
| 11~14 | v3 MVP (Workflow Fabric) | ⏳ 미착수 (PRD/PLAN/checklist 동기화 완료, go-신호 대기) |
| 15~17 | v3 후속 (Connectors / 학습 / 스케줄·UI) | ⏳ 설계 only |
| **D0~D5** | **v3.4 — DGX 런타임 재배치 (선행)** | ⏳ **미착수** (본 PRD의 핵심) |
| (선택) D6 | NIM/TRT-LLM perf 승격 | 옵션 |
| (선택) D7 | 2-DGX 클러스터(200B 클래스) | 옵션 |

### 13.2 v3.4 권장 빌드 순서
**Track A (선행/필수): Phase D0 → D1 → D2 → D3 → D4 → D5**
DGX 런타임 재배치. 각 Phase는 WRITE→BUILD→TEST→VERIFY, verify 미통과 시 다음 Phase 진행 금지.

**Track B (병렬 가능 — D2 완료 후): Phase 11 → 12 → 13 → 14**
v3 워크플로우 MVP. D4(orchestration 재배선) 완료 이후 Phase 13(Workflow Runtime)이 의미를 가짐.

### 13.3 Phase 상세 (D0~D5)
- **D0 — Host Setup.** nvidia driver/CUDA 13 확인, `nvidia-ctk runtime configure --runtime=containerd`, huggingface CLI, NGC API key(선택), `/var/lib/forgenta/{models,postgres,qdrant,minio}` 디렉터리.
  - **verify:** `docker run --rm --gpus all nvcr.io/nvidia/cuda:13.0.0-base-ubuntu24.04 nvidia-smi` → GB10 출력.
- **D1 — k3d + GPU Passthrough + `forgenta-llm` namespace.** `cluster.yaml` ARM64 + `--gpus all` + hostPath mount. NVIDIA device plugin DaemonSet.
  - **verify:** `kubectl describe node ... | grep nvidia.com/gpu` = `1` + GPU 테스트 Pod에서 `nvidia-smi` 출력.
- **D2 — vLLM + Ollama Fallback.** `infra/helm/forgenta-llm` 신규 차트(vllm-planner/executor/small/embed + ollama). `pull-models-dgx.sh`.
  - **verify:** `/v1/models` 노출, SSE 토큰 수신, DCGM `DCGM_FI_DEV_GPU_UTIL` > 0.
- **D3 — inference-gateway.** Go 8800, 모델 라우팅 ConfigMap, SSE pass-through, fallback chain, `/metrics`.
  - **verify:** ig 경유 SSE, planner down 시 fallback 이벤트 + 메트릭 기록.
- **D4 — orchestration 재배선.** `providers.py` OpenAI 호환 클라이언트, `router.py` DGX 정책 기본값, `headroom-proxy` HF tokenizer 백엔드, `.env`/Helm values 갱신.
  - **verify:** `make integration-test` 통과 + `backend=vllm` usage_event 기록.
- **D5 — Observability + SLO 게이트.** `forgenta-obs`에 DCGM Exporter, Grafana `GPU & Inference` 대시보드, vLLM/ig `/metrics` scrape.
  - **verify:** TTFT p95 < 0.7s(Planner 72B), Executor 32B ≥ 60 tok/s, e2e GPU 회귀 케이스 통과.

### 13.4 MVP 정의 (v3.4)
- **v3.4 MVP = Phase D0~D5 + Phase 11~14.** "DGX 위에서 vLLM 추론 + 워크플로우 2단계 핸드오프 + 단계 승인 resume" 종단 동작.
- **Non-goals (v3.4 초기):** NIM 승격(D6), 2-DGX(D7), Phase 15~17 모두 후속.

---

## 14. 관측 (Observability) — v3.4 신규

### 14.1 메트릭 추가
- DCGM Exporter: GPU 온도/전력/메모리/SM occupancy/PCIe-rx-tx.
- vLLM `/metrics`: `vllm:num_requests_running`, `vllm:gpu_cache_usage_perc`, `vllm:time_to_first_token_seconds`, `vllm:e2e_request_latency_seconds`.
- inference-gateway: 백엔드별 RPS/latency/fallback rate, route decision histogram.

### 14.2 Grafana 대시보드
- `Forgenta Overview` (기존) + `GPU & Inference` (신규) + `Routing & Fallbacks` (신규).

### 14.3 SLO 게이트 (Definition of Done)
| 지표 | Mac (참조) | DGX (목표) |
|---|---|---|
| Planner TTFT | 1.5~3.0 s (14B) | **< 0.5 s (72B NVFP4)** |
| Executor 32B 토큰/s | n/a | **≥ 60 tok/s** (단일 요청) |
| 동시 사용자 (스트리밍) | 1~2 | **8~16** |
| 워크플로우 2단계 종단 | 8~20 s | **2~5 s** |
| 임베딩 1k 청크 처리 | ~수십 초 | **< 5 s** |

---

## 15. 성공 지표 (KPIs)
v3.2 §14 운영 가치 지표 그대로 + DGX SLO(§14.3). 추가:
- **로컬 처리 비율 (local_pct).** 전체 토큰 중 vLLM/NIM/Ollama로 처리된 비율. 목표 ≥ 95%(Critic만 외부).
- **GPU utilization 효율.** DCGM 평균 SM occupancy + KV cache 활용도.
- **fallback rate.** vLLM 실패 → NIM/Ollama 전환율. 목표 < 0.5%.

---

## 16. 미해결 결정 (Open Decisions)

### 16.1 v3.2 계승 (그대로)
v3.2 §15의 8개 항목(단계 저장 / 자격증명 백엔드 / Compiler 모델 / 스케줄러 / 브라우저 커넥터 / Obsidian 접근 / 메일 OAuth 분리 / Google Workspace 인증).

### 16.2 v3.4 신규
1. **vLLM vs NIM vs TRT-LLM Planner 1차.** 권장: vLLM 채택 → D6에서 NIM 벤치.
2. **k3d vs k3s native.** 초기 k3d 유지, 재현성/운영성 문제 발생 시 k3s native로 전환.
3. **2nd DGX 추가 시점.** 200B 수요 발생 시(Phase 16 학습 루프 풀스케일).
4. **모델 가중치 저장.** 초기 hostPath `/var/lib/forgenta/models`(ReplicaSet=1), 추후 PVC + ReadOnlyMany.
5. **NVFP4 가용 모델 카탈로그.** HF/NGC 실측 매트릭스를 D0에서 고정.
6. **Critic 백엔드.** 초기 외부 Claude 3.7 유지(편향 분리), 민감 데이터 워크플로우는 Llama-3.1-8B 로컬로 워크스페이스별 오버라이드 허용.

---

## 17. 위험 & 완화 (Risks)

| 위험 | 영향 | 완화 |
|---|---|---|
| NVFP4 가중치 가용성 부족 | 모델 카탈로그 축소 | 초기 FP8/FP16 → D6에서 NVFP4 승격 |
| k3d + GPU passthrough 호환 이슈 | D1 지연 | 폴백: k3s native single-node로 전환 |
| 단일 박스 자원 경합(추론↔DB↔관측) | 지연 spike | PriorityClass + namespace 격리 + KV cache cap |
| HF/NGC 외부 의존성 다운 | 모델 풀 실패 | 로컬 미러 + retry/backoff |
| Ollama 폴백 품질 격차 | 응답 품질 저하 | 사용자 가시 `fallback` 이벤트(투명성) + Critic 자동 평가 |
| Mac 베이스라인 회귀 | 개발자 로컬 미동작 | profile 분기(Mac=Ollama-only, DGX=vLLM-default) — 동일 코드, 다른 env |

---

## 18. 비고 (Notes)

- **본 문서는 설계 전용**(빌드를 직접 명령하지 않는다). 빌드 순서는 `PLAN.dgx.md`(D 시리즈) + `PLAN.md §5`(11~17) + `checklist.md`로 materialize.
- v3.4 발효 시 다음 문서는 본 PRD를 SSOT로 동기화한다:
  - `CLAUDE.md` — §11 DGX 프로필을 본 PRD의 §2/§3/§5/§13으로 흡수, "런타임: MacOS + k3d"를 "런타임: DGX Spark + k3d (Mac은 dev profile)"로 갱신.
  - `PLAN.md` — 본 PRD의 Phase D 시리즈로 갱신.
  - `checklist.md` — Phase D0~D5 체크박스 행 추가.
- v3.2의 Phase 15~17(Connectors / 학습 / 스케줄·UI)는 v3.4에서도 동일 후속 위치. DGX 도입은 그 선행 조건이 아니다(병렬).
- **호환성.** v3.4는 v2/v3.2와 API/DB/UI 계약 무변경. DGX 미보유 개발자는 `OLLAMA_HOST`만 host로 돌려 Mac 베이스라인을 계속 사용 가능(profile 분기).
