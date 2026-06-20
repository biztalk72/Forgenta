> Forgenta 아키텍처 — **DGX Spark 프로필 (v2/v3 ⇒ v2.5-dgx 재설계)**
> CLAUDE.md/PLAN.md(Mac+Ollama 베이스라인)의 모든 결정 중 **하드웨어·런타임·LLM 추론·모델 라우팅·관측 메트릭**
> 항목만 DGX Spark에 맞게 재구성한 단일 진실 소스. **계약(API, DB, 로그/헬스 규격, 거버넌스)은 그대로 유지**한다.

# Forgenta Architecture — DGX Spark Profile

Version: 2.5-dgx | Date: 2026-06-20 | Branch: `feat/dgx-spark` | Host: `zgx-1aee`

---

## 0. 왜 다시 그리는가 (What changes, what stays)

기존 PLAN.md / CLAUDE.md §1은 **Mac (Apple Silicon, 32–64GB) + k3d + Ollama Metal**을 가정한다.
실행 환경이 **NVIDIA DGX Spark (GB10 Grace Blackwell, 128GB unified LPDDR5x, CUDA 13, ARM64 Ubuntu)** 로
바뀌었기 때문에 다음 레이어가 다시 그려진다.

| 레이어 | v2/v3 (Mac/Ollama) | v2.5-dgx (DGX Spark) |
|---|---|---|
| Host OS | macOS Sequoia | Ubuntu (DGX OS) `aarch64`, Kernel 6.17 |
| CPU | Apple M-series (8~14 P/E cores) | Arm Cortex-X925×10 + A725×10 (20-core, 3.9GHz) |
| GPU | Apple Metal (unified) | **NVIDIA GB10 Blackwell (CUDA 13, NVFP4/FP8)** |
| RAM | 32~64GB | **128GB unified LPDDR5x** (Grace↔Blackwell NVLink-C2C) |
| Storage | 1TB SSD | **3.6TB NVMe** (`/dev/nvme0n1p2`) |
| Network | Wi-Fi/1GbE | **2× 200GbE ConnectX-7** (2-node 클러스터 잠재) |
| Inference engine | Ollama (Metal) | **vLLM (primary) + NIM/TensorRT-LLM (perf path) + Ollama (fallback)** |
| Model tier | qwen3 1.7/8/14b | **qwen3/llama 70B+ planner, 32B executor, 8B router** (NVFP4/FP8 양자) |
| Container runtime | Docker Desktop | **containerd + NVIDIA Container Toolkit** |
| Cluster | k3d (CPU only) | **k3d + NVIDIA device plugin (GPU passthrough)** |
| Observability GPU | (없음) | **DCGM Exporter + Grafana NVIDIA dashboards** |

**그대로 두는 것**: 7개 서비스 경계(api-gateway/identity/orchestration/headroom-proxy/catalog/artifact/governance + v3 workflow-svc),
DB 스키마(000001~000008), API 계약, JSON 로그/헬스 규격, RBAC/Governance/Audit, DESIGN.md(Mantine, light/dark, 반응형).

---

## 1. 하드웨어 프로필 (Hardware Baseline)

```
NVIDIA DGX Spark  —  Personal AI Supercomputer
├── SoC          : NVIDIA GB10 Grace Blackwell Superchip
├── CPU          : Arm Cortex-X925 ×10 + A725 ×10 (20c, up to 3.9GHz)
│                   SVE2, bf16, fp16, i8mm, sha512, sve-aes
├── GPU          : NVIDIA Blackwell (datacenter class), CUDA 13.0
│                   NVFP4 / FP8 / FP16 / BF16 tensor cores
├── Memory       : 128GB LPDDR5x (unified, Grace ↔ Blackwell NVLink-C2C)
├── Storage      : NVMe ≈ 3.6TB (root) — model cache + vector DB + MinIO
├── Network      : 2× 200GbE ConnectX-7 (RDMA-capable)
├── Driver       : NVIDIA 580.159.03 / CUDA 13.0
└── OS           : Ubuntu (DGX OS) on Linux 6.17, glibc/musl ok
```

설계상 중요한 함의:
1. **단일 박스에 70B–120B 클래스 모델 상주 가능** (NVFP4 양자 기준). 두 대 클러스터링 시 200B 클래스도 사정거리.
2. **NVLink-C2C 덕분에 CPU↔GPU 텐서 이동이 PCIe 대비 압도적**. orchestration/preprocess와 inference 같은 박스 공존 OK.
3. **CUDA 13 + Blackwell**: NVFP4 활성화. 기존 GGUF Q4_K_M 보다 nvFP4(`.fp4` TRT-LLM/NIM 산출물)가 throughput·품질 모두 우위.

---

## 2. 시스템 토폴로지 (Single-Box Topology)

```
┌──────────────────────────── DGX Spark (host) ───────────────────────────┐
│                                                                          │
│  Browser ─► nginx (web :8080 Ingress) ─► api-gateway :8000               │
│                                              │                           │
│            ┌─────────────────────────────────┼──────────────────────────┐│
│            ▼                ▼                ▼                ▼          ││
│      identity-svc     orchestration-svc   catalog/artifact   workflow   ││
│        :8001          :8002 (LangGraph)   :8003 :8004        -svc :8006 ││
│                          │                                              ││
│                          ├──► headroom-proxy :8787 (압축)                ││
│                          │                                              ││
│                          ├──► **Inference Gateway :8800** (신규)         ││
│                          │       ├─ vLLM (Planner/Executor, 70B/32B)    ││
│                          │       ├─ vLLM (Router/Summarizer, 8B/1.7B)   ││
│                          │       ├─ NIM / TRT-LLM (선택, perf path)      ││
│                          │       └─ Ollama (fallback, 소형/실험)         ││
│                          │                                              ││
│                          └──► governance-svc :8005 (usage/approval)     ││
│                                                                         ││
│  Data plane: PostgreSQL(pgvector+Timescale) · Redis · Qdrant · MinIO    ││
│  Obs plane : Loki + Promtail · Prometheus · Grafana · DCGM Exporter     ││
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                       (선택) 2× 200GbE  →  2nd DGX Spark
                                    │
                       Tensor/pipeline 병렬 200B 모델 서빙
```

---

## 3. 추론 스택 재설계 (Inference Stack)

### 3.1 1차 — vLLM as default
- **이유**: OpenAI-호환 API(`/v1/chat/completions`, `/v1/completions`), 토큰 스트리밍 SSE 기본, PagedAttention,
  continuous batching, LoRA 핫스왑, NVFP4/FP8 지원, OSS, ARM64+CUDA 13 빌드 가능.
- **배포**: k3d 워커 노드에 GPU passthrough, Pod당 1 GPU, 모델 가중치는 PVC(hostPath `/models/`)로 영속.
- **모델 카탈로그(권장 초기 풀)**: 모두 NVFP4 우선, GGUF는 Ollama 폴백 전용.
  | 역할 | 모델 | 정밀도 | KV/추정 RAM | 비고 |
  |---|---|---|---|---|
  | Planner | Qwen3-72B-Instruct (또는 Llama-3.3-70B) | NVFP4 | ~40GB | 다단계 reasoning |
  | Executor | Qwen3-Coder-32B (또는 GPT-OSS-32B) | NVFP4/FP8 | ~18GB | 코드/구조화 출력 |
  | Critic | Llama-3.1-8B-Instruct or external Claude/GPT | FP8 / API | ~6GB | 편향 분리 |
  | Router | Qwen3-1.7B | FP16 | ~3GB | 분류·라우팅 |
  | Summarizer | Qwen3-8B | FP8 | ~6GB | 컨텍스트 압축 보조 |
  | Embed | bge-m3 또는 nomic-embed-text-v2 (vLLM-embed) | FP16 | ~2GB | 검색 임베딩 |
- **VRAM/Unified 계획**: 모두 동시 상주 시 ~75GB → 128GB 안에서 가능. 단, KV cache·동시 요청 헤드룸 30%(≈38GB) 확보.

### 3.2 2차 — NIM / TensorRT-LLM (perf path, optional)
- NGC에서 GB10/Blackwell 호환 NIM 컨테이너 pull → 단일 모델당 별도 Service로 노출(`/v1/chat/completions` 호환).
- NVFP4 엔진(.plan / .trtllm) 산출물 사전 빌드해 `/models/trtllm/<name>/`에 저장.
- vLLM 대비 latency·throughput 우위, 다만 모델 변경 비용 큼 → 안정화된 Planner/Executor만 NIM/TRT-LLM으로 승격.

### 3.3 3차 — Ollama (fallback / 실험)
- Mac 베이스라인의 자산(qwen3:1.7b/8b/14b) 호환 유지. **CUDA 백엔드로 ARM64 빌드**. 큰 모델은 Ollama로 돌리지 않는다.
- `OLLAMA_HOST=http://ollama:11434` (cluster 내부) — orchestration의 폴백 체인 마지막 단계.

### 3.4 Inference Gateway (신규 추상화)
- 새 컴포넌트 ↑ `services/inference-gateway` (Go, 포트 8800).
- 책임: **모델 이름 → 백엔드(vLLM/NIM/Ollama) 라우팅 + 통일된 OpenAI 호환 SSE 노출**.
- ModelRouter(Python, orchestration-svc 내부)는 정책만 결정하고, 실제 호출은 inference-gateway가 멀티플렉싱.
- 헬스: 각 백엔드 `/v1/models` 폴링 + readiness aggregate. 폴백: vLLM 다운 → NIM → Ollama → 502.

---

## 4. 컨테이너 & 클러스터 (Kubernetes on DGX)

### 4.1 컨테이너 런타임
- **containerd + NVIDIA Container Toolkit** (`nvidia-ctk runtime configure --runtime=containerd`).
- Docker Desktop은 사용하지 않는다. 이미지 빌드는 `docker buildx --platform linux/arm64`로 직접 또는 `nerdctl`/`buildkit`.

### 4.2 k3d on DGX Spark
- k3d는 ARM64 + GPU 모두 지원. `cluster.yaml`에 변경 사항:
  - `image: docker.io/rancher/k3s:v1.31.x-k3s1` (ARM64 multiarch).
  - 워커 노드에 `--gpus all` 노출(`docker run --gpus all` 대신 k3d의 `--gpus` 플래그) + `containerd` 안에서 NVIDIA runtime 등록.
- **NVIDIA device plugin 설치**: `kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.16.x/nvidia-device-plugin.yml`.
- Pod 스펙에 `resources.limits["nvidia.com/gpu"]: 1` 으로 vLLM/NIM/Ollama 파드만 GPU 점유.
- 대안(추후): k3d 대신 **k3s native install** + DGX OS에 직접 systemd 등록(개발/운영 동일 환경 원하면).

### 4.3 네임스페이스(불변)
- `forgenta-infra` (Postgres/Redis/Qdrant/MinIO)
- `forgenta-core`  (api/identity/orchestration/headroom/catalog/artifact/governance/workflow/**inference-gateway**)
- `forgenta-llm`   (**신규**: vLLM/NIM/Ollama — GPU 점유 파드 격리)
- `forgenta-obs`   (Loki/Prometheus/Grafana/**DCGM**)
- `forgenta-ui`    (web/nginx)

### 4.4 노드 풀
- 단일 노드. 자원 분리는 namespace + `requests/limits` + PriorityClass(`llm-critical` > `core` > `infra` > `obs`)로 달성.
- 2-DGX 클러스터로 확장 시: 2번째 노드를 `forgenta-llm-2` 레이블로 추가, vLLM tensor-parallel(`--tensor-parallel-size 2`)로 70B+ 모델 분산.

---

## 5. 데이터/스토리지 레이아웃

`/dev/nvme0n1p2` (3.6TB) 위에서:
```
/var/lib/forgenta/
├── models/                # 70~80GB 권장 상한 (NVFP4/FP8 가중치)
│   ├── vllm/<repo>/<rev>/
│   ├── trtllm/<name>/<engine>.plan
│   └── ollama/            # ~/.ollama 매핑
├── postgres/              # PVC backing
├── qdrant/                # 벡터 DB
├── minio/                 # 산출물 버킷
└── grafana/loki/          # 관측 영속화
```
- **PVC**: `local-path`(k3s 내장) 또는 `hostPath`(개발 편의). 운영 단일 박스이므로 ReplicaSet=1로 충분.
- **Model fetch**: `infra/scripts/pull-models.sh` 재작성 — `huggingface-cli download` + `nvidia-trtllm-builder`(선택).

---

## 6. ModelRouter 정책 재정의 (orchestration-svc)

`env`로 주입되는 기본값을 DGX 프로필로 갱신.

```bash
DEFAULT_PLANNER_MODEL=vllm/qwen3-72b-instruct-nvfp4
DEFAULT_EXECUTOR_MODEL=vllm/qwen3-coder-32b-fp8
DEFAULT_CRITIC_MODEL=claude-3-7-sonnet            # 편향 분리 — 외부 유지
DEFAULT_SUMMARIZER_MODEL=vllm/qwen3-8b-fp8
DEFAULT_ROUTER_MODEL=vllm/qwen3-1.7b
DEFAULT_EMBED_MODEL=vllm/bge-m3
INFERENCE_GATEWAY_URL=http://inference-gateway.forgenta-core:8800
OLLAMA_HOST=http://ollama.forgenta-llm:11434     # 폴백
```

정책 규칙(기존 유지 + 추가):
- **민감 데이터 → 로컬 전용** (vLLM/NIM/Ollama만 허용, Critic 외부 호출 금지 플래그).
- **품질 등급 high & budget OK → Planner 70B**, 그 외는 32B Executor만.
- **코드 의도 감지 → Coder-32B**.
- **장문(>32k context) → Qwen3-8B with sliding window + headroom 압축 선행**.
- **첫 토큰 지연 > N → 더 작은 모델로 강등** (latency-aware re-route).
- **GPU mem pressure(DCGM `DCGM_FI_DEV_FB_USED` > 85%) → planner 비활성, executor만**.

---

## 7. Headroom Proxy 변경점

- 기능 자체는 동일(Kompress/SmartCrusher/CodeCompressor).
- **토크나이저 백엔드**를 vLLM/HF 토크나이저로 교체(`tokenizers` Rust 바인딩, ARM64+CUDA 무관). Ollama 토크나이저 의존 제거.
- 압축 결정 입력에 `target_model_max_ctx` 주입(예: Qwen3-72B 128k, 32B 64k, 8B 32k) — 모델별 컨텍스트 윈도우 차이를 라우터에 반영.

---

## 8. 관측 (Observability)

### 8.1 메트릭 추가
- **DCGM Exporter** (`forgenta-obs`): GPU 온도/전력/메모리/SM occupancy/PCIe-rx-tx.
- **vLLM /metrics**: `vllm:num_requests_running`, `vllm:gpu_cache_usage_perc`, `vllm:time_to_first_token_seconds`, `vllm:e2e_request_latency_seconds`.
- **inference-gateway**: 백엔드별 RPS/latency/fallback rate, route decision histogram.
- 기존 서비스 `/metrics` 그대로(§7 로그 규격 유지).

### 8.2 Grafana 대시보드
- `Forgenta Overview`(기존) + `GPU & Inference`(신규: vLLM·DCGM 조합) + `Routing & Fallbacks`(신규).

### 8.3 로그 필드 확장 (§7 호환)
기존 JSON 로그에 다음 키 옵셔널 추가:
```
"backend":       "vllm" | "nim" | "trtllm" | "ollama" | "external",
"gpu_index":     0,
"kv_cache_pct":  37.2,
"ttft_ms":       210
```

---

## 9. 보안·거버넌스 (변경 없음)

- JWT/RBAC/Audit/Approval — 그대로.
- 추가 권장(운영 단계):
  - SELinux/AppArmor enforce, `--cap-drop ALL` + `seccomp=default`.
  - 모델 가중치는 read-only PVC 마운트.
  - inference-gateway는 클러스터 내부 전용(외부 노출 금지). 외부는 항상 api-gateway 경유.

---

## 10. 성능 목표 (DGX 베이스라인)

| 지표 | Mac (참조) | DGX Spark (목표) |
|---|---|---|
| Planner TTFT | 1.5~3.0 s (14B) | **< 0.5 s (72B NVFP4)** |
| Executor 32B 토큰/s | n/a | **≥ 60 tok/s** (단일 요청) |
| 동시 사용자 (스트리밍) | 1~2 | **8~16** |
| 워크플로우 2단계 종단 | 8~20 s | **2~5 s** |
| 임베딩 1k 청크 처리 | ~수십 초 | **< 5 s** |

DCGM + vLLM 메트릭으로 회귀 가드(Grafana SLO 패널).

---

## 11. v2/v3 호환 매트릭스 (Compat Matrix)

| v2/v3 산출물 | DGX 프로필에서의 상태 |
|---|---|
| DB 마이그레이션 000001~000008 | **그대로 사용** (golang-migrate, ARM64 컨테이너 그대로) |
| API 계약 / JSON 로그 / 헬스 | **그대로** (§§6~8 CLAUDE.md) |
| api-gateway / identity / catalog / artifact / governance / workflow-svc | **그대로** (ARM64 cross-compile, base image만 갱신) |
| orchestration-svc | **수정**: provider client → inference-gateway, ModelRouter 기본값 갱신 |
| headroom-proxy | **수정 경량**: 토크나이저 백엔드 교체, ctx 윈도우 인자 추가 |
| Ollama | **격하**: 폴백/실험 전용 |
| **inference-gateway** (신규) | 신규 Go 서비스, vLLM/NIM/Ollama 멀티플렉서 |
| Helm 차트 `forgenta-infra`/`core`/`obs`/`ui` | **그대로 + `forgenta-llm` 추가** |
| DESIGN.md(Mantine) | **그대로** |
| 워크플로우(v3 Phase 11~17) | **그대로 + Phase 18(=v2.5-dgx Phase D, 본 문서) 선행** |

---

## 12. 결정 대기 (Open Decisions)

`context-notes.md`에 기록 후 빌드 중 확정:
1. **vLLM vs NIM vs TRT-LLM**의 Planner 1차 채택 — 초기엔 vLLM, 안정화 후 NIM 비교 벤치.
2. **k3d vs k3s native** — 운영성/재현성 트레이드오프. 초기 k3d 유지.
3. **2nd DGX 추가 시점** — 200B 클래스 수요 발생 시(예: workflow Phase 16 학습 루프).
4. **모델 가중치 저장 위치** — `/var/lib/forgenta/models` (hostPath) vs PVC. 초기 hostPath, ReplicaSet=1.
5. **NVFP4 가용 모델 카탈로그** — HF/NGC에서 실제 풀 가능한 정밀도 매트릭스를 Phase D0에서 고정.

---

## 13. 참고 (References inside this repo)

- `CLAUDE.md` — 빌드 가이드 (호환 유지, §1 preflight는 DGX 변형 §14 신설)
- `PLAN.md` §0~§4 — v2 베이스라인 / §5 v3 워크플로우 — 모두 호환
- `PLAN.dgx.md` — **본 문서의 짝**: DGX 적용 단계별 Loop Harness
- `checklist.md` — Phase D0~D5 항목 추가 예정
- `DESIGN.md` — UI/UX, 변동 없음

— EOF
