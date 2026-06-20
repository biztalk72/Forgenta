# Forgenta v3 빌드 핸드오프 (Workflow Fabric)

> 새 세션이 `docs/prd/Forgenta PRD v3.md`를 단일 진실 소스로 v3를 이어서 빌드하기 위한 진입 문서.
> 작성 2026-06-20. 기준 브랜치 main.

---

## 0. 한 줄 요약

v2(단발성 에이전트 플랫폼)는 완성·가동 중이고, v3(자연어→검토/승인→다중 에이전트 공유 컨텍스트 실행 "Workflow Fabric")는
**Phase 11(데이터 스키마)까지 머지 완료**. 다음 작업은 **Phase 12(workflow-svc + Compiler)**.

## 1. 단일 진실 소스 (먼저 읽을 것)

- `docs/prd/Forgenta PRD v3.md` — v3 제품 요구사항(Agentic Operations). **최우선.**
- `PLAN.md` §5 + Loop 7 — v3 빌드 플랜(Phase 11~17), 각 단계 산출물·verify.
- `checklist.md` — v3 체크리스트(Phase 11 완료 체크됨, 12~17 대기).
- `DESIGN.md` — UI 헌법. `CLAUDE.md` §3.5에 연동됨.
- `CLAUDE.md` — 빌드 가이드 + 공통 규격(§6 헬스, §7 JSON 로그, §8 오류, §4 Makefile 패턴).
- `context-notes.md` — 결정 기록 + RESUME 스냅샷(v2 전체 + UI 확장 이력).

## 2. 현재 상태 (2026-06-20)

- **v2 완료** — 10 Phase. 7 서비스(api-gateway/identity/orchestration/headroom/catalog/artifact/governance)
  + 인프라(PG·Redis·Qdrant·MinIO) + web + 관측(Loki/promtail/Grafana) 전부 in-cluster 가동.
- **v3 진행** — PR #2(플랜 문서) MERGED, PR #3(Phase 11 마이그레이션) MERGED.
- **DB** — schema **version 8** clean, 신규 3 테이블 존재. ✅ **Phase 11 verify 통과(2026-06-20)**: v3.4 교정본
  000008 재적용 완료 — `workflow_step_run_kind_check`(llm|tool|approval|export) + `workflow_run.status`에 pending 존재.
  (재적용 과정에서 `infra/scripts/migrate.sh`의 `down 1` 단일-인자 버그를 수정함.) §3 = 현재 DB 기준. PRD v3.4 §6.A가 spec 계약.
- **클러스터** — infra 4 / core 7 / ui 1 / obs 5 pod Running. UI `http://forgenta.localhost:8080`
  (로그인 `admin@forgenta.local` / `forgenta`). Grafana는 `kubectl port-forward -n forgenta-obs svc/grafana 3000:3000`.
- **다음** — Phase 12.

## 3. v3 데이터 모델 (이미 적용됨 — `db/migrations/000008_workflow`)

- `workflow` — workspace FK, `name`/`description`, `spec` JSONB(컴파일된 정의), `source`(nl|demo|manual),
  `status`(draft|active|archived), `version`, `created_by`, ts.
- `workflow_run` — workflow FK, workspace_id, `status`(pending|running|awaiting_approval|succeeded|failed|cancelled),
  `trigger`, `context` JSONB(**blackboard**, 단계 간 공유), `summary`, started/finished_at.
- `workflow_step_run` — run FK, `step_seq`, `kind`(llm|tool|approval|export), `agent_id`,
  `status`(pending|running|awaiting_approval|succeeded|failed|skipped), `input` JSONB, `output_artifact_id`,
  prompt/completion_tokens, latency_ms, `error`, `approval_id`, UNIQUE(run_id, step_seq).
- 인덱스 4종(workspace별 workflow, workflow/workspace별 run, run별 step).

## 4. 빌드 환경 재개 (클러스터를 내렸을 때)

```bash
make cluster-up          # k3d + 네임스페이스
make migrate             # 마이그레이션(version 8까지)
make images              # 7개 서비스 + web 이미지 빌드 + k3d import
make deploy-core         # forgenta-core
helm upgrade --install forgenta-ui  infra/helm/forgenta-ui  -n forgenta-ui
helm upgrade --install forgenta-obs infra/helm/forgenta-obs -n forgenta-obs
make integration-test    # 6/6
make e2e-test            # 7/7
```

## 5. 다음 단계 — Phase 12~14 (v3 MVP)

### Phase 12 — workflow-svc + Compiler (Loop 3 확장)
- `services/workflow-svc`(Go, **catalog-svc 구조 그대로**, 포트 8006) — workflow/run CRUD + clone(`entity_type='workflow'`)
  + 오케스트레이션용 내부 write API: `POST /v1/runs`, `PATCH /v1/runs/{id}`, `POST /v1/runs/{id}/steps`, `PATCH /v1/steps/{id}`.
- 게이트웨이 `/api/workflow/` 서브트리 프록시 + `WORKFLOW_URL`. `go.work` / Helm(`workflow.*`, 8006) /
  `workflow-svc.yaml` / `build-images.sh` 배선.
- orchestration `app/compiler.py` — NL 설명 → `workflow.spec` JSON, SSE `plan`/`step`. `app/main.py`에 `POST /v1/workflows/compile`.
  출력 spec은 **PRD v3.4 §6.A JSON Schema**(version/steps[seq,kind,ref,input_map,output_key,requires_approval,on_error,handoff_to])로 검증 + 실패 시 재시도(로컬 모델 비결정성 대비).
- **verify** — workflow-svc build/vet, 게이트웨이 경유 workflow CRUD + clone 계보, compile SSE가 steps≥2 + **§6.A 스키마 valid** spec 반환.

### Phase 13 — Workflow Runtime (Loop 3/4)
- orchestration `app/runtime.py` — spec steps 실행, 단계별 기존 `ModelRouter`+`providers.stream` 재사용.
  `workflow_run.context`(blackboard) 유지 + 단계 간 handoff, 누적 컨텍스트는 `integrations.compress`로 압축.
- `POST /v1/workflows/{id}/run`(SSE: meta/plan/step_start/token/handoff/step_done/fallback/done) + `POST /v1/runs/{id}/cancel`.
  단계 종료마다 workflow-svc step write + governance usage 기록.
- **verify** — 2단계 run → step_run 2건 + context handoff + done 이벤트.

### Phase 14 — 단계 승인 HITL (Loop 3e/4)
- governance `approval` 재사용 — `resource_type='workflow_step_run'`, `resource_id=step_run_id`.
- `requires_approval` 단계는 step_run을 `awaiting_approval`로 저장 + approval 생성 후 정지 → `POST /v1/runs/{id}/resume`로 재개, reject 시 halt.
- 프론트 — `/workflows`(검색→설명→compile→검토/저장), `/runs`(타임라인·live SSE·approve/reject/resume). `lib/stream`에 `streamCompile`/`streamRun` 추가.
- **verify** — approval 생성/정지 → approve 후 resume, reject 후 halt. integration/e2e에 워크플로우 플로우 추가 + 기존 회귀 유지.

(Phase 15~17은 PLAN §5 / checklist 참조 — Connectors, 학습/이상탐지, 스케줄/UI.)

## 6. 따라야 할 코드 패턴 (재사용 우선, "rebuild 금지")

- **새 Go 서비스** — `services/catalog-svc`를 템플릿으로 복제(`internal/config`, `internal/server`, `cmd/main.go`,
  go.mod에 `replace github.com/forgenta/shared => ../shared`). Dockerfile은 **repo 루트 컨텍스트**(shared 포함).
  배선 5곳 — `go.work` use, `build-images.sh`(build+import), `infra/helm/forgenta-core/values.yaml`,
  `templates/<svc>.yaml`, `api-gateway.yaml`의 `<SVC>_URL` env + `cmd/main.go` stripProxy 라우트 + config.go.
- **게이트웨이 함정** — 게이트웨이 Deployment에 `<SVC>_URL` env를 빠뜨리면 기본값 localhost로 **502**. (Phase 6에서 실제 발생.)
- **워크스페이스/유저 컨텍스트** — 서비스는 게이트웨이가 주입하는 `X-Workspace-Id`/`X-User-Id` 헤더에서 읽음.
- **orchestration** — 토큰 SSE는 `providers.stream` 직접 사용(LangGraph 토큰 스트리밍 회피). 서비스 간 연동은
  `app/integrations.py` 패턴(fault-tolerant, 실패해도 파이프라인 비차단). usage는 governance `/v1/usage`로 기록.
- **마이그레이션** — `db/migrations/000009_*`부터. `make migrate`(in-cluster `migrate/migrate` Job + ConfigMap).
- **프론트** — Mantine v7, react-router v6, `lib/stream`(SSE-over-fetch, POST+JWT), `lib/api`(REST+JWT),
  `?param` 라우팅, `ChatMessage` 버블 패턴. 빌드 게이트 = `npm run build`(tsc+vite) + `npm test`.
- **검증** — 단계마다 `make integration-test`/`make e2e-test` 회귀 유지. 스크립트 포트포워드는 비경합 포트(18080/18081) + /health 폴링.

## 7. 멀티세션 주의 (중요)

- **워킹트리가 세션 간 공유됨.** 다른 세션이 같은 디렉터리에서 편집할 수 있음.
- 커밋은 **파일 단위 explicit `git add`**(`-A` 지양)로 자기 산출물만 담을 것.
- main은 보호됨(`reset --hard` 차단). **브랜치 → PR** 워크플로우 사용. PR 머지 후 `git fetch`로 origin/main 동기 확인(로컬 ref 지연될 수 있음).
- **v3 빌드는 한 세션만 드라이브.** Phase 12는 orchestration/gateway/go.work를 동시에 건드려 충돌 위험이 큼.

## 8. 미해결/후속 (v2에서 이월)

- 클라우드 LLM 실제 연동(현재 스텁), OIDC/SAML, k8s Secret 전환(현재 values.yaml 평문 creds),
  Prometheus 메트릭(서비스 `/metrics` 미계측 — 현재 obs는 로그 중심), OTel 트레이싱.
- `.env.example` — 내장 시크릿 가드로 에이전트가 생성 불가, 사용자가 `!` heredoc로 수동 생성 필요.
- 카탈로그 데모 agent 3종(요약가/번역가/코드리뷰어) 시드됨.
