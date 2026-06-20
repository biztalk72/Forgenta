> Forgenta — **DGX Spark 재구축 플랜**. `ARCHITECTURE.dgx.md`의 짝.
> v2 베이스라인(`PLAN.md` §0~§4)과 v3 워크플로우(`PLAN.md` §5)는 호환 유지.
> **Phase D0~D5**를 추가하고, 기존 Phase 4(Orchestration)와 Phase 1(Infra)의 일부를 DGX 프로필로 갱신한다.

# Forgenta v2.5-dgx 재구축 플랜 (Plan)

Version: 2.5-dgx | Date: 2026-06-20 | Branch: `feat/dgx-spark` | Host: `zgx-1aee`

---

## 0. 범위 & 비목표

**범위**:
- Mac/Ollama 가정에서 DGX Spark(GB10 / CUDA 13 / 128GB unified / ARM64) 로의 **런타임/추론/관측 레이어 재배치**.
- vLLM(+선택 NIM/TensorRT-LLM) 도입, Inference Gateway 신설, ModelRouter 정책 갱신.
- 기존 7개 서비스 + v3 워크플로우는 **계약 무변경** — 빌드 타깃만 ARM64 Linux로 정렬.

**비목표**:
- UI(Mantine, DESIGN.md) 재설계 ❌
- DB 스키마(000001~000008) 변경 ❌
- API 계약 / JWT / RBAC / Audit 변경 ❌
- 멀티 노드 클러스터링(2번째 DGX) — 후속 옵션. MVP는 단일 박스.

---

## 1. 사전 확인 (Pre-flight for DGX Spark)

CLAUDE.md §1을 대체하는 DGX 전용 체크:

```bash
# 필수 명령
command -v nvidia-smi  || echo "MISSING: NVIDIA driver"
command -v nvidia-ctk  || echo "MISSING: NVIDIA Container Toolkit"
command -v containerd  || echo "MISSING: containerd"
command -v k3d         || echo "MISSING: k3d (curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash)"
command -v helm        || echo "MISSING: helm"
command -v kubectl     || echo "MISSING: kubectl"
command -v go          || echo "MISSING: go 1.22+"
command -v python3     || echo "MISSING: python 3.12+"
command -v node        || echo "MISSING: node 20+"
command -v huggingface-cli || echo "MISSING: pip install -U 'huggingface_hub[cli]'"

# 검증
nvidia-smi | grep -q "GB10"     || echo "WARN: GB10 not detected"
nvidia-ctk --version            || echo "MISSING: install nvidia-container-toolkit"
ls /proc/driver/nvidia/version  || echo "MISSING: nvidia kernel module"
```

**최소 사양 (실측 기준)**:
- DGX Spark 또는 동급 (GB10/Blackwell, 128GB unified, CUDA 13).
- NVMe 여유 디스크 ≥ 200GB (모델 캐시 80GB + 운영 영속화 + 빌드 캐시).
- 네트워크: 외부 HF/NGC 도달성(`hf.co`, `nvcr.io`).

---

## 2. Loop Harness 매핑 (CLAUDE.md §3 호환)

| Loop | 기존 의미 | DGX 프로필에서 |
|---|---|---|
| Loop 1 (Infra) | Postgres/Redis/Qdrant/MinIO | **+ NVIDIA device plugin, DCGM exporter, `forgenta-llm` namespace** |
| Loop 2 (DB) | golang-migrate | 변경 없음 (ARM64 컨테이너 그대로) |
| Loop 3 (Services) | 7개 + v3 workflow-svc | **+ inference-gateway**, orchestration provider 교체 |
| Loop 4 (Integration) | 게이트웨이↔서비스↔Ollama | **게이트웨이↔서비스↔inference-gateway↔vLLM** |
| Loop 5 (Frontend) | Mantine 빌드/테스트 | 변경 없음 |
| Loop 6 (E2E) | 3대 플로우 | 동일 + **GPU/추론 SLO 회귀 가드** (TTFT, tok/s) |
| Loop 7 (Workflow) | v3 워크플로우 | 호환 (백엔드만 vLLM/NIM) |

---

## 3. 단계별 플랜 (Phased Plan — DGX Profile)

각 Phase는 **WRITE→BUILD→TEST→VERIFY** 루프. `verify` 미통과 시 다음 Phase로 진행 금지.

### Phase D0 — Pre-flight & Host Setup
호스트 준비 + 컨테이너/GPU 런타임 정합.
- NVIDIA driver/CUDA 13 확인, `nvidia-ctk runtime configure --runtime=containerd --set-as-default && systemctl restart containerd`.
- huggingface-cli 로그인 (필요 시 HF 토큰), NGC API key(NIM 사용 시).
- `/var/lib/forgenta/{models,postgres,qdrant,minio}` 디렉터리 생성 + 소유권/권한.
- **verify**: `docker run --rm --gpus all nvcr.io/nvidia/cuda:13.0.0-base-ubuntu24.04 nvidia-smi` 가 GB10을 출력.

### Phase D1 — k3d + GPU Passthrough
GPU를 보는 클러스터.
- `infra/k3d/cluster.yaml` 갱신:
  - ARM64 k3s 이미지 고정 (`rancher/k3s:vX.Y.Z-k3s1` + `--platform linux/arm64`).
  - k3d 에이전트 노드에 `--gpus all` (k3d `--gpus all` 플래그) + extra mounts (`/var/lib/forgenta/models:/models`).
- NVIDIA device plugin DaemonSet 적용 (`kube-system` 또는 `forgenta-llm`).
- `forgenta-llm` 네임스페이스 신설.
- **verify**: `kubectl describe node ... | grep nvidia.com/gpu` 가 `1` 보고. `kubectl run gpu-test --rm -it --image=nvcr.io/nvidia/cuda:13.0.0-base-ubuntu24.04 --restart=Never --overrides='{"spec":{"containers":[{"name":"c","image":"nvcr.io/nvidia/cuda:13.0.0-base-ubuntu24.04","resources":{"limits":{"nvidia.com/gpu":"1"}},"command":["nvidia-smi"]}]}}'` 가 GB10 출력.

### Phase D2 — Inference Stack (vLLM + Ollama fallback)
GPU 위에서 추론.
- `infra/helm/forgenta-llm` 신규 차트:
  - `vllm-planner` (Qwen3-72B-Instruct NVFP4, 1 GPU, KV cache cap)
  - `vllm-executor` (Qwen3-Coder-32B FP8)
  - `vllm-small` (Qwen3-8B + Qwen3-1.7B 다중 served-model-name)
  - `vllm-embed` (bge-m3)
  - `ollama` (fallback, CUDA 백엔드)
- 모델 가중치 사전 다운로드 스크립트 `infra/scripts/pull-models-dgx.sh` (huggingface-cli).
- 각 vLLM Pod readiness: `/health` 200 & `/v1/models` 비어있지 않음.
- **verify**:
  - `kubectl port-forward svc/vllm-planner 8000:8000 -n forgenta-llm && curl -s :8000/v1/models` 에 planner 모델 노출.
  - `curl -s :8000/v1/chat/completions -d '{"model":"qwen3-72b-instruct-nvfp4","messages":[{"role":"user","content":"hi"}],"stream":true}'` SSE 토큰 수신.
  - DCGM Exporter: `DCGM_FI_DEV_GPU_UTIL` > 0 동안 부하.

### Phase D3 — Inference Gateway (신규 서비스)
모델 이름 → 백엔드 라우팅 + 통일 OpenAI 호환.
- `services/inference-gateway` (Go, 포트 8800). 라우팅 테이블 ConfigMap (`model-routes.yaml`):
  ```yaml
  routes:
    - match: "qwen3-72b-*"          backend: http://vllm-planner.forgenta-llm:8000
    - match: "qwen3-coder-32b*"     backend: http://vllm-executor.forgenta-llm:8000
    - match: "qwen3-(8b|1.7b)*"     backend: http://vllm-small.forgenta-llm:8000
    - match: "bge-*"                backend: http://vllm-embed.forgenta-llm:8000
    - match: "ollama/*"             backend: http://ollama.forgenta-llm:11434
    - match: "claude-*"             backend: external                # orchestration-svc에서 직접
  ```
- 책임: SSE pass-through(`flushInterval=-1`), backend down 시 폴백 체인, 메트릭(`/metrics`, Prom).
- **verify**:
  - 게이트웨이 경유 `POST /v1/chat/completions` SSE 응답.
  - planner 다운 시 fallback(예: small)으로 라우팅되고 `fallback="true"` 이벤트가 로그·메트릭에 기록.

### Phase D4 — Orchestration 재배선
orchestration-svc(Python, LangGraph)에서 Ollama 직접 호출을 inference-gateway 호출로 교체.
- `app/providers.py`: Ollama 클라이언트를 OpenAI-호환 클라이언트로 치환(`INFERENCE_GATEWAY_URL`).
- `app/router.py` 정책 기본값 갱신 (ARCHITECTURE.dgx.md §6).
- headroom-proxy 토크나이저 백엔드를 vLLM 호환(`tiktoken`/HF tokenizers)으로 교체.
- `.env.example`/Helm `forgenta-core/values.yaml`에 새 env 키 반영.
- **verify**:
  - `integration-test.sh`(기존) 통과 + 추가 시나리오: planner=qwen3-72b 라우팅, executor=coder-32b 라우팅, fallback 발생/회복.
  - `governance-svc` usage_event에 backend 필드가 vllm으로 기록.

### Phase D5 — Observability + SLO 게이트
관측과 회귀 가드.
- `forgenta-obs` 차트에 **DCGM Exporter** 추가, Grafana provisioning에 `GPU & Inference` 대시보드.
- vLLM `/metrics`/inference-gateway `/metrics` Prometheus scrape.
- Grafana SLO 패널: `vllm:time_to_first_token_seconds_bucket` p95, `e2e_request_latency_seconds`, fallback rate.
- **verify**:
  - 부하 시 GPU util/mem/kv 메트릭이 그래프에 그려짐.
  - TTFT p95 < 0.7s (Planner 72B NVFP4 단일 요청 기준), Executor 32B 토큰/s ≥ 60.
  - E2E (`e2e-test.sh`)에 GPU 백엔드용 회귀 케이스 추가 후 통과.

### (선택) Phase D6 — NIM / TensorRT-LLM 승격
안정화 후 perf path.
- 핵심 모델(Planner/Executor)을 NIM 또는 TRT-LLM 엔진(.plan)으로 빌드.
- inference-gateway 라우팅 테이블만 교체 → 서비스 무중단 스왑.
- **verify**: 동일 프롬프트 벤치마크에서 TTFT/throughput 개선 입증, 품질 회귀 없음(critic 비교).

### (선택) Phase D7 — 2-DGX 클러스터
ConnectX-7 200GbE 활용.
- 2번째 노드 추가, vLLM `--tensor-parallel-size 2` Planner 모델(예: 120B+ NVFP4).
- `nvidia.com/gpu` 1대씩 점유, KV cache 분산.
- **verify**: 200B 클래스 모델 서빙 정상, 200GbE 링크 utilization 측정.

---

## 4. 변경되는 파일·디렉터리 (Change Map)

| 경로 | 동작 |
|---|---|
| `ARCHITECTURE.dgx.md` | **신규** (본 PR) |
| `PLAN.dgx.md` | **신규** (본 PR) |
| `CLAUDE.md` | **§11 신설** — DGX Spark 프로필 (preflight, models, runtime) |
| `infra/k3d/cluster.yaml` | **수정** — ARM64 + `--gpus all` + hostPath mount |
| `infra/helm/forgenta-llm/` | **신규** — vLLM/NIM/Ollama 차트 묶음 |
| `infra/helm/forgenta-obs/` | **수정** — DCGM Exporter 추가 + 대시보드 |
| `infra/helm/forgenta-core/values.yaml` | **수정** — `INFERENCE_GATEWAY_URL`, ModelRouter defaults |
| `infra/scripts/pull-models-dgx.sh` | **신규** — huggingface-cli 기반 |
| `infra/scripts/bootstrap.sh` | **수정** — Phase D1~D2 자동화 |
| `services/inference-gateway/` | **신규** Go 서비스 (포트 8800) |
| `services/orchestration-svc/app/providers.py` | **수정** — OpenAI 호환 클라이언트 |
| `services/orchestration-svc/app/router.py` | **수정** — DGX 정책 기본값 |
| `services/headroom-proxy/` | **소폭 수정** — HF tokenizer 백엔드 |
| `.env.example` | **수정** — DGX 키 셋업 |
| `Makefile` | **수정** — `make llm-up`, `make models-dgx`, `make verify-dgx` 타깃 추가 |
| `checklist.md` | **수정** — Phase D0~D5 항목 추가 |
| 기타 services/* (api-gateway/identity/catalog/artifact/governance/workflow-svc) | **무변경** (ARM64 cross-compile만 확인) |

---

## 5. 위험·완화 (Risks)

| 위험 | 영향 | 완화 |
|---|---|---|
| NVFP4 가중치 가용성 부족 | 모델 카탈로그 축소 | 초기 FP8/FP16 시작 → Phase D6에서 NVFP4 승격 |
| k3d + GPU passthrough 미묘한 호환 이슈 | Phase D1 지연 | 폴백: k3s native single-node install로 전환 |
| 단일 박스 자원 경합(추론↔DB↔관측) | 지연 spike | PriorityClass + GPU 점유 namespace 격리 + KV cache cap |
| 외부 의존성(HF/NGC 다운) | 모델 풀 실패 | 로컬 미러 디렉터리 + retry/exponential backoff |
| Ollama 폴백 품질 격차 | 폴백 시 응답 품질 저하 | 사용자 가시 `fallback` 이벤트(투명성), critic 자동 평가 |

---

## 6. 성공 기준 (Definition of Done)

- `bash infra/scripts/bootstrap.sh` 후 `kubectl get pods -A` 가 모두 Running/Ready (forgenta-llm 포함).
- `make integration-test` 통과 + DGX 회귀 케이스 추가분 포함.
- `make e2e-test` 통과 + TTFT/throughput SLO 측정값이 §10 목표(ARCHITECTURE.dgx.md) 충족.
- Grafana `GPU & Inference` 대시보드에서 GPU/vLLM 메트릭 가시화.
- `governance-svc` usage_event에 `backend=vllm` 으로 기록되고, 폴백 시 `backend=ollama` 로 분기 기록.

---

## 7. 오케스트레이션 (Build Order)

권장 진행:
1. Phase D0 (호스트) → D1 (클러스터+GPU) → D2 (vLLM/Ollama) → D3 (inference-gateway) → D4 (orchestration 재배선) → D5 (관측/SLO).
2. 병렬 가능 단위(이후 자식 에이전트 위임 시): D2(LLM 차트)와 D3(inference-gateway)는 D1 이후 동시 진행 가능.
3. 단독 진행: 순차. 각 verify 게이트 통과 필수.

— EOF
