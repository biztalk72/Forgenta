# Forgenta v1.2 시스템 아키텍처 문서

## 문서 목적

본 문서는 Forgenta v1.2의 화면 IA를 기술 구조로 번역하는 시스템 아키텍처 문서다. 특히 본 문서는 각 화면이 어떤 서비스와 데이터를 호출하는지 대응시키는 것을 핵심 목표로 하며, 화면 구조와 시스템 구조가 어긋나지 않도록 제품 관점과 기술 관점을 연결한다.[cite:154][cite:155] 시스템 아키텍처 문서는 시스템을 여러 시점에서 보여주고, 사용자 상호작용이 어떤 컴포넌트를 거쳐 어떤 데이터에 도달하는지 명확히 표현할수록 팀의 공통 이해를 높인다.[cite:154][cite:155]

Forgenta는 카탈로그 기반 재사용, 멀티모달 출력, 대시보드형 운영 UX, 엔터프라이즈 인증 및 거버넌스를 갖춘 하이브리드 에이전틱 AI 앱 플랫폼이다. 따라서 아키텍처도 단일 웹앱 + 단일 API 구조가 아니라, 인증, 프롬프트 정제, 오케스트레이션, 카탈로그, 멀티모달 아티팩트, 데이터 플랫폼, 감사·정책 계층으로 분리하는 편이 적절하다.[cite:127][cite:137][cite:165]

## 아키텍처 원칙

### 1. Screen-to-service alignment

각 화면은 자신이 담당하는 사용자 행동에 대응되는 서비스만 호출해야 한다. 화면과 서비스의 경계가 뒤섞이면 프론트엔드와 백엔드가 함께 복잡해지고, 이후 기능 확장 시 비용이 급격히 커진다.[cite:154][cite:155]

### 2. API as product

API는 단순 내부 연결이 아니라 장기적으로 유지되는 제품처럼 다뤄야 한다. 엔터프라이즈 API 모범사례는 각 API에 오너, 수명주기, 관측성, 권한 통제를 부여할 것을 권장한다.[cite:165][cite:168]

### 3. Centralized governance, distributed execution

정책과 감사 기준은 중앙에서 관리하되, 프롬프트 실행, 카탈로그 조회, 차트 렌더링, 데이터 검색은 각 서비스가 분산 실행하는 구조가 바람직하다.[cite:165][cite:127]

### 4. Minimum viable architecture

MVP 단계에서는 모든 것을 마이크로서비스로 쪼개기보다, 분리할 책임은 논리적으로 명확히 두고 배포 단위는 최소화하는 것이 유리하다. 최소 실행 가능 아키텍처는 빠른 개발과 이후 확장의 균형을 맞추는 접근이다.[cite:136][cite:163]

## 상위 시스템 구성

Forgenta v1.2의 상위 시스템은 아래 8개 컨테이너로 나눈다.[cite:154][cite:155]

| 컨테이너 | 역할 |
|---|---|
| Web Dashboard App | 사용자가 보는 UI, IA 기반 화면, 상태 관리 |
| API Gateway / BFF | 프론트엔드용 집계 API, 인증 컨텍스트 전달 |
| Identity Service | 로그인, 세션, 역할, 워크스페이스 컨텍스트 |
| Prompt & Orchestration Service | 프롬프트 정제, 실행 계획, 모델 호출 조율 |
| Catalog Service | Agent/App 카탈로그 조회, 상세, 복제, 이동, 삭제 |
| Artifact Service | CSV, 이미지, SVG, 차트 메타데이터와 다운로드 처리 |
| Data Platform | Lakehouse, Vector Store, Serving DB, ETL/Indexing |
| Governance & Audit Service | 정책 검사, 승인, 로그, 감사 추적 |

## 화면-서비스-데이터 매핑

이 표는 Forgenta 설계의 핵심이다. 어떤 화면이 어떤 서비스와 데이터를 호출하는지를 명시하면, IA에서 정의한 사용자 흐름을 구현 가능한 기술 구조로 내릴 수 있다.[cite:154][cite:155]

| 화면 | 주요 사용자 행동 | 호출 서비스 | 주요 데이터 |
|---|---|---|---|
| Splash / Login | 로그인 방식 선택, 세션 시작 | Identity Service, API Gateway | UserProfile, Workspace, Session |
| Main Dashboard | 질문 입력, 추천 확인, 결과 확인 | Prompt & Orchestration Service, Catalog Service, Artifact Service | PromptTemplate, PromptExecution, RecommendationSet, OutputArtifact |
| Prompt Compare Panel | 원문/정제본 비교, 저장 | Prompt & Orchestration Service | PromptDraft, PromptTemplate, PromptVersion |
| Output Panel | 표/CSV/이미지/SVG/차트 조회·다운로드 | Artifact Service, Prompt & Orchestration Service | OutputArtifact, ChartSpec, FileManifest |
| Agent Catalog | 검색, 필터, 상세 열기 | Catalog Service, API Gateway | CatalogItem, Tag, Owner, UsageStats |
| App Catalog | 검색, 실행, 대시보드 추가 | Catalog Service, Artifact Service | CatalogItem, AppPreview, Placement |
| Catalog Detail Rollup | Use/Edit/Clone/Delete/Move | Catalog Service, Governance & Audit Service | CatalogItem, CloneLineage, PermissionState |
| Builder / Editor | 수정, 테스트, 저장, 배포 | Prompt & Orchestration Service, Catalog Service, Data Platform | DraftConfig, DatasetBinding, OutputConfig |
| Admin Console | 승인, 권한, 로그, 데이터셋 등록 | Governance & Audit Service, Identity Service, Data Platform | AuditLog, ApprovalItem, RoleBinding, DatasetRegistry |

## 사용자 요청 기준 데이터 흐름

### 1. 로그인 흐름

사용자가 Splash 화면에서 Google, Microsoft, SSO, Email 중 하나를 선택하면 Web Dashboard App은 API Gateway를 통해 Identity Service와 통신한다. 인증 성공 후 Identity Service는 사용자 프로필, 역할, 워크스페이스 컨텍스트를 반환하고, Web App은 이를 기반으로 메뉴와 권한 가시성을 구성한다.[cite:155][cite:168]

### 2. 질문 실행 흐름

질문 실행은 Forgenta의 핵심 흐름이므로 가장 명확하게 정의해야 한다. 사용자 입력은 먼저 Prompt & Orchestration Service로 들어가 정제, 보안 필터링, 의도 분류를 거친 뒤, 필요 시 Data Platform의 Vector Store와 Lakehouse를 참조해 검색과 질의 계획을 만든다.[cite:127][cite:137] 실행 결과는 텍스트 응답과 함께 구조화 결과, 차트 정의, 파일 아티팩트를 Artifact Service에 저장하고, Web App은 이를 Output Panel에 유형별로 렌더링한다.[cite:159][cite:165]

### 3. 카탈로그 탐색 흐름

사용자가 Agent Catalog 또는 App Catalog를 열면 Web App은 Catalog Service를 호출해 목록, 필터 메타데이터, 권한 가능한 액션을 함께 가져온다. 항목 선택 시 상세 메타데이터, 샘플 출력, 사용량, 상태, 오너십 정보가 롤업 패널에 로드된다.[cite:165]

### 4. 복제·삭제·이동 흐름

Clone, Delete, Move 같은 상태 변경 액션은 Catalog Service가 직접 처리하되, 실행 전후로 Governance & Audit Service가 권한 검사와 감사 기록을 담당해야 한다. 이렇게 하면 카탈로그 조작 경험은 부드럽게 유지하면서도 거버넌스가 분리된다.[cite:165]

## 논리 아키텍처

### 1. Web Dashboard App

책상 위의 작업대에 해당하는 계층이다. 역할은 화면 렌더링, 사용자 상태 관리, 결과 뷰 전환, 오버레이 제어, 파일 다운로드 요청, 전역 탐색을 담당하는 것이다. 프론트엔드는 가능한 한 비즈니스 로직을 얇게 유지하고, 서버에서 제공된 상태와 권한 정보에 따라 UI를 결정해야 한다.[cite:154]

### 2. API Gateway / BFF

BFF(Backend for Frontend)는 여러 하위 서비스를 화면 친화적으로 묶어주는 계층이다. 예를 들어 Main Dashboard는 질문 실행 결과, 추천 예제, 최근 사용 항목을 한 번에 받아야 할 수 있으므로, BFF가 각 서비스를 집계해 프론트엔드에 맞는 응답으로 만드는 편이 좋다.[cite:154][cite:159]

### 3. Identity Service

Identity Service는 인증과 인가의 기준점이다. 로그인 공급자 연동, 세션/토큰 검증, 역할과 워크스페이스 맵핑, 기본 프로필 정보를 담당한다. 권한은 다른 서비스마다 흩어져 있으면 안 되고, 최소한 권한 판단의 원천 정보는 중앙화되어야 한다.[cite:165][cite:168]

### 4. Prompt & Orchestration Service

이 서비스는 Forgenta의 두뇌다. 자유 입력 정제, 유사 예제 추천, 질의 라우팅, RAG 실행, SQL/테이블 질의 선택, 아티팩트 생성 플랜 작성, 후속 액션 추천을 담당한다.[cite:127][cite:137] 한마디로 사용자의 “말”을 시스템이 실행 가능한 “계획”으로 바꾸는 번역기이자 지휘자다.

### 5. Catalog Service

Catalog Service는 앱/에이전트 자산의 소스 오브 트루스다. 목록, 상세, 검색, 필터링, 복제, 이동, 삭제, 상태 변경, 카탈로그 배치 정보, 사용 통계를 관리한다. 이 서비스는 Prompt Service와 분리되어야 “실행 로직”과 “자산 수명주기”가 섞이지 않는다.[cite:165]

### 6. Artifact Service

멀티모달 결과를 안정적으로 다루려면 아티팩트 전용 계층이 필요하다. CSV, SVG, 이미지, 차트 정의, 다운로드 메타데이터, 렌더링 실패 상태를 이 서비스가 관리하면 Output Panel이 훨씬 단순해진다.[cite:159]

### 7. Governance & Audit Service

정책 검증, 승인, 액션 감사, 로그 조회는 반드시 별도 계층으로 두는 것이 좋다. 엔터프라이즈 AI 시스템에서는 관측성과 거버넌스가 부가 기능이 아니라 핵심 설계 요소다.[cite:127][cite:128][cite:165]

### 8. Data Platform

Data Platform은 크게 네 부분으로 나뉜다.

| 구성요소 | 역할 |
|---|---|
| Lakehouse | 제조 공개 데이터, synthetic HR/finance 데이터, 문서 원본과 정제 데이터 저장 |
| Vector Store | 문서/프롬프트/카탈로그 자산 임베딩 검색 |
| Serving DB | 사용자, 세션, 카탈로그 메타데이터, 프롬프트 버전, 아티팩트 메타데이터 |
| ETL / Indexing Pipelines | 적재, 정제, 청킹, 임베딩, 재색인 |

데이터 파이프라인 아키텍처는 원천에서 소비계층까지의 흐름을 명확히 구분할수록 운영과 문제해결이 쉬워진다.[cite:158]

## 배포 관점 아키텍처

MVP 단계에서는 아래 두 가지 배포 전략 중 하나를 권장한다.[cite:136][cite:163]

| 전략 | 설명 | 추천도 |
|---|---|---|
| Modular Monolith + Separate Data Services | 비즈니스 서비스는 하나의 백엔드 코드베이스 안에서 모듈화하고, 데이터 저장소는 별도 운영 | 높음 |
| Early Microservices | 서비스별 별도 배포와 독립 스케일링 | 낮음 |

Forgenta v1.2는 기능이 많아 보이지만 아직 MVP이므로, 애플리케이션 계층은 모듈형 모놀리스로 시작하고, Identity, Storage, Data Platform은 외부 또는 독립 배포로 두는 방식이 현실적이다.[cite:136][cite:163]

## 추천 기술 구조

이 문서는 특정 벤더 종속이 목적은 아니지만, MVP 생산성을 고려할 때 아래 조합이 현실적이다.

| 레이어 | 권장 기술 예시 |
|---|---|
| Frontend | React + TypeScript + component system |
| BFF / API | FastAPI 또는 NestJS |
| Auth | Auth provider + OIDC/SAML bridge |
| Data Platform | Object Storage + Lakehouse table format + Vector DB + PostgreSQL |
| Artifact Storage | Object Storage + signed download metadata |
| Charts | Plotly/ECharts 등 2D·3D 지원 라이브러리 |
| Observability | Central logging + traces + metrics |

## API 리소스 목록 초안

RESTful API는 리소스 중심, 느슨한 결합, 명확한 버전 전략을 가져야 한다.[cite:168] Forgenta의 MVP 리소스는 아래처럼 시작하는 것이 적절하다.

### 인증
- `POST /api/v1/auth/login/google`
- `POST /api/v1/auth/login/microsoft`
- `POST /api/v1/auth/login/sso`
- `POST /api/v1/auth/login/email`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`

### 프롬프트/챗
- `POST /api/v1/prompts/refine`
- `POST /api/v1/prompts/compare`
- `GET /api/v1/prompts/templates`
- `POST /api/v1/chat/sessions`
- `POST /api/v1/chat/sessions/{id}/messages`
- `GET /api/v1/chat/sessions/{id}/outputs`

### 카탈로그
- `GET /api/v1/catalog/agents`
- `GET /api/v1/catalog/apps`
- `GET /api/v1/catalog/items/{id}`
- `POST /api/v1/catalog/items/{id}/clone`
- `POST /api/v1/catalog/items/{id}/move`
- `DELETE /api/v1/catalog/items/{id}`
- `POST /api/v1/catalog/items/{id}/use`

### 빌더
- `POST /api/v1/build/agents`
- `PATCH /api/v1/build/agents/{id}`
- `POST /api/v1/build/apps`
- `PATCH /api/v1/build/apps/{id}`
- `POST /api/v1/build/{type}/{id}/test-run`
- `POST /api/v1/build/{type}/{id}/publish`

### 아티팩트
- `GET /api/v1/artifacts/{id}`
- `GET /api/v1/artifacts/{id}/download`
- `POST /api/v1/artifacts/svg/render`
- `POST /api/v1/artifacts/charts/render`

### 관리자
- `GET /api/v1/admin/approvals`
- `POST /api/v1/admin/approvals/{id}/approve`
- `POST /api/v1/admin/approvals/{id}/reject`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/datasets`

## API 설계 규칙

- 모든 리소스는 버전 prefix(`/api/v1`)를 가진다.[cite:168]
- 목록 응답은 pagination, sorting, filtering을 표준화한다.[cite:159]
- 상태 변경 액션은 audit event를 자동 생성한다.[cite:165]
- 다운로드는 metadata endpoint와 signed URL 또는 proxied download를 분리한다.[cite:159]
- 프론트엔드가 권한 UI를 제어할 수 있도록 action availability를 응답에 포함한다.[cite:165]

## 화면별 와이어프레임 초안 가이드

와이어프레임은 구조를 잡는 설계도다. 이 문서를 바탕으로 그려야 할 최소 화면은 아래와 같다.[cite:154]

| 화면 | 핵심 블록 |
|---|---|
| Splash/Login | 로고, 로그인 버튼 4종, 설명, 보안 링크 |
| Dashboard | Sidebar, Topbar, Chat Composer, Prompt Compare, Recommendation Rail, Output Panel |
| Agent Catalog | 검색, 필터, 카드/리스트, 상세 롤업 |
| App Catalog | 검색, 필터, 프리뷰, 상세 롤업 |
| Builder | 좌측 설정 탭, 중앙 편집, 우측 테스트 결과 |
| Admin Console | KPI 상단, 승인 큐, 로그 테이블, 데이터셋 목록 |

## MVP 개발 백로그 초안

MVP 백로그는 시스템 구조를 반영해야 한다. 즉, 사용자 스토리와 기술 스토리가 따로 노는 것이 아니라, 한 스프린트 안에서 화면-API-서비스-데이터가 함께 완성되도록 묶는 것이 중요하다.[cite:160][cite:163]

### Epic 1. Authentication & Workspace
- Google/MS/SSO/Email 로그인
- 사용자 프로필 및 워크스페이스 로딩
- 역할 기반 메뉴 가시성

### Epic 2. Dashboard Core
- 기본 3패널 레이아웃
- 챗 입력과 세션 히스토리
- Output Panel 탭 구조

### Epic 3. Prompt Intelligence
- 프롬프트 정제
- 원문 vs 정제본 비교
- 유사 예제 추천

### Epic 4. Catalog Reuse
- Agent/App 카탈로그 조회
- 상세 패널
- Use / Clone / Delete / Move

### Epic 5. Multimodal Output
- 텍스트/표 렌더링
- CSV 다운로드
- 이미지 미리보기/다운로드
- SVG 렌더링
- 2D/3D 차트 렌더링

### Epic 6. Governance
- 승인 큐
- 감사 로그
- 권한 검사와 액션 제어

## 스프린트 분해 초안

### Sprint 1
- 로그인 화면
- 기본 대시보드 레이아웃
- `/auth`, `/me` API
- Sidebar / Topbar / 빈 Output Panel

### Sprint 2
- 챗 세션 생성
- 프롬프트 정제 API
- Prompt Compare UI
- 기본 텍스트 응답

### Sprint 3
- Agent/App 카탈로그 목록/상세
- Use / Clone 플로우
- 추천 예제 API

### Sprint 4
- 표/CSV 결과
- 이미지/SVG 결과
- 아티팩트 다운로드

### Sprint 5
- 2D/3D 차트
- Delete / Move UI
- 감사 로그 이벤트 생성

### Sprint 6
- Admin Console Lite
- 승인 큐
- 성능/보안/관측성 안정화

## 기술적 리스크와 완화

### 1. 멀티모달 출력 복잡도

텍스트 응답만 만들 때보다 결과 타입이 늘어나면 렌더링 실패 케이스와 저장 포맷이 급증한다. 따라서 아티팩트 전용 서비스와 표준 메타데이터 스키마를 초기에 두는 것이 중요하다.[cite:159]

### 2. 카탈로그와 실행 로직 결합 위험

카탈로그가 실행 로직까지 직접 품으면 서비스 책임이 커진다. 카탈로그는 자산 수명주기, 오케스트레이션은 실행 계획에 집중하도록 분리해야 유지보수성이 높다.[cite:154][cite:165]

### 3. 인증/권한 복잡도

로그인 제공자가 여러 개여도 권한 판단 기준은 하나여야 한다. Identity Service를 중심으로 RoleBinding과 WorkspaceContext를 통일해야 한다.[cite:165][cite:168]

## 다음 단계 산출물

이 문서를 기준으로 즉시 이어질 수 있는 다음 산출물은 다음과 같다.

- 화면별 와이어프레임 초안.
- OpenAPI 스타일 API 명세 초안.
- 데이터 모델 ERD.
- MVP 백로그를 Jira/Linear 단위로 쪼갠 구현 티켓 목록.

특히 다음 문서로는 “화면별 와이어프레임 초안” 또는 “API 명세 초안”이 가장 자연스럽다. 현재 문서가 이미 화면과 서비스, 데이터의 대응 관계를 잡았기 때문에 이제는 각각을 더 세밀한 설계로 내리면 된다.[cite:154][cite:168]
