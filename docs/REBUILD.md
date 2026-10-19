# 재빌드 가이드

점검일 `2026-10-19`. 기준 체크아웃 `feat/phase-13-workflow-runtime`, 문서 작성 전 HEAD `645852f1e8f0bd6d46aae3cbeeb616f4e0f0c177`. 이 문서는 실제 파일에서 추출한 근거이며 전체 빌드 성공을 뜻하지 않는다.

## 프로젝트 및 근거

Forgenta is a hybrid agentic AI platform designed for enterprise internal data — manufacturing, HR, and finance. It provides a streaming RAG chat interface, an agent/app catalog, and a prompt refinement engine, all powered by a local LLM via Ollama.

- 설명 근거. `README.md`.
- 매니페스트. `Makefile`, `go.work`, `services/api-gateway/Dockerfile`, `services/api-gateway/Makefile`, `services/api-gateway/go.mod`, `services/artifact-svc/Dockerfile`, `services/artifact-svc/Makefile`, `services/artifact-svc/go.mod`, `services/catalog-svc/Dockerfile`, `services/catalog-svc/Makefile`, `services/catalog-svc/go.mod`, `services/governance-svc/Dockerfile`, `services/governance-svc/Makefile`, `services/governance-svc/go.mod`, `services/headroom-proxy/Dockerfile`, `services/headroom-proxy/Makefile`, `services/headroom-proxy/go.mod`, `services/identity-svc/Dockerfile`, `services/identity-svc/Makefile`, `services/identity-svc/go.mod`, `services/orchestration-svc/Dockerfile`, `services/orchestration-svc/Makefile`, `services/orchestration-svc/pyproject.toml`, `services/shared/go.mod`, `services/workflow-svc/Dockerfile`, `services/workflow-svc/Makefile`, `services/workflow-svc/go.mod`, `web/Dockerfile`, `web/package.json`
- 잠금 파일. `go.work.sum`, `services/api-gateway/go.sum`, `services/artifact-svc/go.sum`, `services/catalog-svc/go.sum`, `services/governance-svc/go.sum`, `services/identity-svc/go.sum`, `services/shared/go.sum`, `services/workflow-svc/go.sum`, `web/package-lock.json`

## 설치 및 지원 런타임

현재 호스트의 최신 런타임을 지원 버전으로 간주하지 않는다. 프로젝트의 버전 파일·매니페스트·CI가 우선이다. 아래 설치 명령은 복원용이며 이번 작업에서 일괄 실행하지 않았다. 설치 전 lifecycle/hook 스크립트를 검토한다.

### `web/package.json`

- 패키지 매니저 선언. `미선언; 로컬 잠금 파일로 추론`.
- engines. `{}`.
- 설치 명령. `npm ci`.
- 실행 위치. `web`.
- 설치 시 실행 가능 스크립트. 루트 매니페스트에 없음. 의존 패키지 스크립트는 별도 확인.
- 선언된 scripts. `dev`, `build`, `preview`, `test`.

### `services/orchestration-svc/pyproject.toml`

- requires-python. `>=3.12`. build backend. `setuptools.build_meta`.
- 선택 extras. `dev` dependency groups. 없음.
- 복원. 잠금 파일이 없다. 기존 README/Makefile의 설치 방식을 우선하고 해석된 의존성을 검토한다. 임의로 최신 버전을 고정하지 않는다.
- 개발 도구 설정. `setuptools`, `pytest`

- Rust/Swift/Go는 각각 `rust-toolchain*`, `Package.swift`의 tools-version, `go.mod`/`go.work`의 버전과 기존 CI를 따른다. 네이티브·iOS 빌드는 Xcode/SDK/서명·플랫폼 라이브러리를 추가 확인한다.

## 저장소에 실제 선언된 실행·검증 명령

실행 위치가 `.`이 아니면 해당 하위 디렉터리에서 실행한다. 아래 항목은 선언 확인이며 실행 결과가 아니다.
- `make build` — 위치 `services/api-gateway`; 근거 `services/api-gateway/Makefile:6`.
- `make test` — 위치 `services/api-gateway`; 근거 `services/api-gateway/Makefile:9`.
- `make lint` — 위치 `services/api-gateway`; 근거 `services/api-gateway/Makefile:15`.
- `make build` — 위치 `services/artifact-svc`; 근거 `services/artifact-svc/Makefile:6`.
- `make test` — 위치 `services/artifact-svc`; 근거 `services/artifact-svc/Makefile:9`.
- `make lint` — 위치 `services/artifact-svc`; 근거 `services/artifact-svc/Makefile:15`.
- `make build` — 위치 `services/catalog-svc`; 근거 `services/catalog-svc/Makefile:6`.
- `make test` — 위치 `services/catalog-svc`; 근거 `services/catalog-svc/Makefile:9`.
- `make lint` — 위치 `services/catalog-svc`; 근거 `services/catalog-svc/Makefile:15`.
- `make build` — 위치 `services/governance-svc`; 근거 `services/governance-svc/Makefile:6`.
- `make test` — 위치 `services/governance-svc`; 근거 `services/governance-svc/Makefile:9`.
- `make lint` — 위치 `services/governance-svc`; 근거 `services/governance-svc/Makefile:15`.
- `make build` — 위치 `services/headroom-proxy`; 근거 `services/headroom-proxy/Makefile:6`.
- `make test` — 위치 `services/headroom-proxy`; 근거 `services/headroom-proxy/Makefile:9`.
- `make lint` — 위치 `services/headroom-proxy`; 근거 `services/headroom-proxy/Makefile:15`.
- `make build` — 위치 `services/identity-svc`; 근거 `services/identity-svc/Makefile:6`.
- `make test` — 위치 `services/identity-svc`; 근거 `services/identity-svc/Makefile:9`.
- `make lint` — 위치 `services/identity-svc`; 근거 `services/identity-svc/Makefile:15`.
- `make install` — 위치 `services/orchestration-svc`; 근거 `services/orchestration-svc/Makefile:6`.
- `make test` — 위치 `services/orchestration-svc`; 근거 `services/orchestration-svc/Makefile:9`.
- `make lint` — 위치 `services/orchestration-svc`; 근거 `services/orchestration-svc/Makefile:15`.
- `make build` — 위치 `services/workflow-svc`; 근거 `services/workflow-svc/Makefile:6`.
- `make test` — 위치 `services/workflow-svc`; 근거 `services/workflow-svc/Makefile:9`.
- `make lint` — 위치 `services/workflow-svc`; 근거 `services/workflow-svc/Makefile:15`.
- `npm run dev` — 위치 `web`; 근거 `web/package.json:7`.
- `npm run build` — 위치 `web`; 근거 `web/package.json:8`.
- `npm run test` — 위치 `web`; 근거 `web/package.json:10`.

## 환경변수·서비스·데이터 복원

- 실제 `.env`와 인증정보는 Git에 보존하지 않는다. 프로젝트의 기존 예제와 비밀 저장소에서 재발급·주입한다.
- 코드 및 예제에서 발견한 환경변수 이름은 `env.required.example`에 있다. 모든 변수가 필수라는 뜻은 아니다.
- 마이그레이션은 적용 전 대상 DB·백업·복구 지점을 확인한다. 운영 DB에 자동 실행하지 않는다.
- DB/모델/업로드 문서는 소스 저장소만으로 복구되지 않을 수 있다. 아래 제외 항목과 기존 데이터 복원 절차를 확인한다.
- 마이그레이션 관련 파일. `db/migrations/000001_init_extensions.down.sql`, `db/migrations/000001_init_extensions.up.sql`, `db/migrations/000002_core_identity.down.sql`, `db/migrations/000002_core_identity.up.sql`, `db/migrations/000003_catalog.down.sql`, `db/migrations/000003_catalog.up.sql`, `db/migrations/000004_artifact.down.sql`, `db/migrations/000004_artifact.up.sql`, `db/migrations/000005_governance_metering.down.sql`, `db/migrations/000005_governance_metering.up.sql`, `db/migrations/000006_seed.down.sql`, `db/migrations/000006_seed.up.sql`, `db/migrations/000007_admin_password.down.sql`, `db/migrations/000007_admin_password.up.sql`, `db/migrations/000008_workflow.down.sql`.

## 이번 점검에서 실행한 검증

매니페스트 파싱 및 Python AST 구문 검사를 수행했다. 의존성 설치, 전체 테스트, 프런트엔드 프로덕션 빌드, 외부 API·DB·GPU·서명·배포 검증은 별도로 명시하지 않는 한 미실행이다.
- 상세 결과. `rebuild-validation.json`.
- 정적 검사 통과 `13`건, 실패 `0`건.

## 보존 제외·수동 복원

아래 목록은 안전 정책으로 선택하지 않은 파일이다. 이미 과거 이력에 들어 있는 파일을 삭제하거나 이력을 정리했다는 뜻은 아니다. 생성물은 재생성하고, 원본 데이터·모델·비밀값은 별도 복원한다.
- 선택 파일 목록에서 별도 제외 항목을 발견하지 않았다. gitignore된 실제 비밀·데이터가 없다는 뜻은 아니다.

공통 개발환경 복원 자료. https://github.com/biztalk72/agent-harness/tree/backup/final-20261019-environment
