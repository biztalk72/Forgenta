# Forgenta v1.2 후속 산출물 패키지

## 문서 목적

본 문서는 Forgenta v1.2 시스템 아키텍처 문서를 기준으로 즉시 이어질 수 있는 4개의 후속 산출물을 하나의 패키지로 정리한 문서다. 포함 범위는 화면별 와이어프레임 초안, OpenAPI 스타일 API 명세 초안, 데이터 모델 ERD 초안, 그리고 MVP 백로그를 Jira/Linear 단위로 분해한 구현 티켓 목록이다.[cite:170][cite:175][cite:182] 와이어프레임은 구조와 상호작용을 빠르게 정렬하는 도구이고, OpenAPI는 프론트엔드와 백엔드의 계약을 명시하는 기계 판독 가능한 스펙이며, ERD와 티켓 분해는 구현 리스크와 일정 통제를 가능하게 한다.[cite:170][cite:171][cite:175]

## 1. 화면별 와이어프레임 초안

좋은 와이어프레임은 보기 좋은 화면을 그리는 것이 아니라, 사용자가 어디서 무엇을 보고 무엇을 누르며 어떤 결과를 받는지를 구조적으로 드러낸다.[cite:170][cite:172] 특히 대시보드형 제품에서는 헤더, 내비게이션, 입력 영역, 결과 영역의 우선순위를 먼저 고정해야 이후 시각 디자인이나 컴포넌트 작업이 흔들리지 않는다.[cite:170][cite:173]

### 1.1 Splash / Login

**목적:** 사용자가 신뢰감 있게 로그인 방식을 선택하고 워크스페이스로 진입한다.[cite:177]

**레이아웃**
- 좌상단: Forgenta 로고
- 중앙 헤드라인: 제품명 + 한 줄 설명
- 중앙 카드: Google / Microsoft / Enterprise SSO 버튼
- 카드 하단: Email 로그인 폼
- 최하단: Terms / Privacy / Security 링크

**핵심 액션**
- 로그인 방식 선택
- 인증 오류 시 인라인 메시지 확인
- 성공 시 Dashboard 이동

### 1.2 Main Dashboard

대시보드 와이어프레임은 핵심 질문 입력과 결과 소비가 하나의 흐름으로 이어지게 만들어야 한다.[cite:170][cite:173] Forgenta는 카탈로그 기반 재사용과 멀티모달 결과를 함께 다뤄야 하므로 3-패널 구성이 가장 적합하다.[cite:171][cite:172]

**레이아웃**
- 좌측 Sidebar: Home, Agents, Apps, Builder, Datasets, Admin, Recent, Favorites
- 상단 Topbar: Global Search, Workspace Switcher, Notifications, Profile
- 중앙 Main Workspace:
  - Chat Composer
  - Prompt Compare Panel
  - Recommended Templates / Similar Agents
  - Session History
- 우측 Output Panel:
  - Tabs: Text / Table / CSV / Image / SVG / 2D Chart / 3D Chart
  - Actions: Download, Save, Pin, Reuse

**핵심 액션**
- 질문 입력
- 정제 프롬프트 비교
- 추천 항목 선택
- 결과 확인 및 다운로드

### 1.3 Agent Catalog

**목적:** 에이전트를 검색, 탐색, 실행, 복제, 수정한다.

**레이아웃**
- 상단: Search, Filter, Sort, View Toggle
- 본문: Card/List Grid
- 우측 Rollup Detail Panel:
  - Summary
  - Owner / Tags / Dataset Bindings
  - Usage Stats
  - Actions: Use, Edit, Clone, Delete, Move

**핵심 액션**
- 검색 및 필터링
- 상세 확인
- 즉시 실행 또는 복제

### 1.4 App Catalog

**목적:** 앱형 자산을 탐색하고 대시보드 또는 작업공간에 배치한다.

**레이아웃**
- Agent Catalog와 같은 기본 구조
- 추가 블록:
  - Preview Thumbnail
  - Supported Output Types
  - Add to Dashboard

### 1.5 Builder / Editor Lite

빌더 화면은 설정-테스트-결과의 왕복 구조가 분명해야 한다.[cite:171][cite:183] 복잡한 설정이 많더라도 사용자는 항상 “무엇을 바꾸고, 지금 어떤 결과가 나오는지”를 한 화면 안에서 이해할 수 있어야 한다.[cite:183]

**레이아웃**
- 좌측 설정 탭: Prompt / Data Sources / Outputs / Guardrails / Version
- 중앙 편집 패널: Prompt Form, Structured Config Editors
- 우측 테스트 패널: Test Run Result, Validation, Warning
- 상단 액션 바: Save Draft, Publish, Clone, Delete

### 1.6 Admin Console Lite

**목적:** 승인, 권한, 감사 로그, 데이터셋 관리.

**레이아웃**
- 상단 KPI Bar: Pending Approvals, Failed Jobs, Active Users, Storage Usage
- 좌측 섹션 탭: Approvals / Audit Logs / Roles / Datasets
- 메인 영역: Table + Filters + Detail Drawer

## 2. OpenAPI 스타일 API 명세 초안

OpenAPI는 REST API를 코드 없이도 이해하고, 테스트와 SDK 생성에 활용할 수 있도록 표현하는 명세 방식이다.[cite:175] 초기 초안에서는 전체 스키마를 완성하기보다 리소스 체계, 메서드, 공통 응답, 인증 구조를 먼저 일관되게 잡는 것이 중요하다.[cite:175][cite:168]

### 2.1 공통 규칙

- Base URL: `/api/v1`
- Content-Type: `application/json`
- 인증: `Bearer Token`
- Pagination: `page`, `page_size`
- Sorting: `sort_by`, `sort_order`
- Filter는 리소스별 query params 사용

### 2.2 공통 에러 응답

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to move this catalog item.",
    "trace_id": "trc_123456"
  }
}
```

### 2.3 OpenAPI 예시 스켈레톤

```yaml
openapi: 3.1.0
info:
  title: Forgenta API
  version: 1.2.0
servers:
  - url: /api/v1
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - bearerAuth: []
paths:
  /me:
    get:
      summary: 현재 로그인 사용자 정보 조회
      responses:
        '200':
          description: 사용자 프로필 반환
  /catalog/items:
    get:
      summary: 카탈로그 항목 목록 조회
      parameters:
        - in: query
          name: type
          schema:
            type: string
            enum: [agent, app]
        - in: query
          name: q
          schema:
            type: string
      responses:
        '200':
          description: 목록 반환
  /catalog/items/{id}/clone:
    post:
      summary: 카탈로그 항목 복제
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '201':
          description: 복제 완료
  /chat/sessions:
    post:
      summary: 새 대화 세션 생성
      responses:
        '201':
          description: 세션 생성 완료
  /chat/sessions/{id}/messages:
    post:
      summary: 메시지 전송 및 실행
      responses:
        '200':
          description: 실행 결과 반환
  /artifacts/{id}/download:
    get:
      summary: 결과 파일 다운로드
      responses:
        '200':
          description: 파일 스트림 또는 서명 URL 반환
```

### 2.4 리소스 목록

| 도메인 | 엔드포인트 예시 |
|---|---|
| Auth | `POST /auth/login/google`, `POST /auth/login/sso`, `GET /me` |
| Chat | `POST /chat/sessions`, `POST /chat/sessions/{id}/messages` |
| Prompt | `POST /prompts/refine`, `POST /prompts/compare` |
| Catalog | `GET /catalog/items`, `GET /catalog/items/{id}`, `POST /catalog/items/{id}/clone` |
| Builder | `POST /build/agents`, `PATCH /build/apps/{id}`, `POST /build/{type}/{id}/publish` |
| Artifacts | `GET /artifacts/{id}`, `GET /artifacts/{id}/download`, `POST /artifacts/charts/render` |
| Admin | `GET /admin/approvals`, `POST /admin/approvals/{id}/approve`, `GET /admin/audit-logs` |

## 3. 데이터 모델 ERD 초안

ERD는 데이터 구조를 정적인 상자 그림으로만 보는 것이 아니라, 사용자 행동이 저장과 조회 구조로 어떻게 번역되는지를 보여줘야 한다.[cite:182] Forgenta에서는 인증, 카탈로그, 실행 기록, 멀티모달 결과, 승인, 데이터셋 연결이 핵심 엔터티다.

### 3.1 핵심 엔터티 목록

| 엔터티 | 설명 |
|---|---|
| User | 사용자 기본 정보 |
| Workspace | 조직 또는 프로젝트 컨텍스트 |
| RoleBinding | 사용자-워크스페이스 권한 매핑 |
| CatalogItem | Agent/App 공통 상위 자산 |
| AgentConfig | 에이전트 설정 상세 |
| AppConfig | 앱 설정 상세 |
| PromptTemplate | 저장된 프롬프트 템플릿 |
| PromptExecution | 실제 실행 기록 |
| OutputArtifact | 실행 결과 메타데이터 |
| DatasetRegistry | 연결 가능한 데이터셋 정의 |
| DatasetBinding | 자산과 데이터셋 연결 |
| ApprovalItem | 승인 대상 |
| AuditLog | 액션 감사 로그 |

### 3.2 관계 초안

```text
User 1---N RoleBinding N---1 Workspace
Workspace 1---N CatalogItem
CatalogItem 1---0..1 AgentConfig
CatalogItem 1---0..1 AppConfig
CatalogItem 1---N DatasetBinding N---1 DatasetRegistry
CatalogItem 1---N PromptTemplate
PromptTemplate 1---N PromptExecution
PromptExecution 1---N OutputArtifact
CatalogItem 1---N ApprovalItem
User 1---N AuditLog
CatalogItem 1---N AuditLog
Workspace 1---N AuditLog
```

### 3.3 테이블 필드 초안

#### User
- id
- email
- name
- status
- created_at
- last_login_at

#### Workspace
- id
- name
- type
- status
- created_at

#### RoleBinding
- id
- user_id
- workspace_id
- role
- created_at

#### CatalogItem
- id
- workspace_id
- type(agent/app)
- name
- description
- owner_user_id
- visibility
- status(draft/published/archived)
- cloned_from_item_id
- created_at
- updated_at

#### PromptExecution
- id
- catalog_item_id
- user_id
- session_id
- input_text
- refined_prompt
- execution_status
- model_route
- started_at
- finished_at

#### OutputArtifact
- id
- prompt_execution_id
- artifact_type(text/table/csv/image/svg/chart2d/chart3d)
- storage_uri
- mime_type
- metadata_json
- created_at

#### AuditLog
- id
- actor_user_id
- workspace_id
- target_type
- target_id
- action
- result
- trace_id
- created_at

## 4. MVP 백로그를 Jira/Linear 단위로 쪼갠 구현 티켓 목록

좋은 백로그는 거대한 아이디어 저장소가 아니라, 가까운 시기에 실제 착수 가능한 작업 목록이어야 한다.[cite:178][cite:180] 또한 사용자 가치와 기술 기반 작업을 함께 묶어, 화면과 API와 데이터가 한 스프린트 안에서 연결되도록 해야 한다.[cite:180][cite:182]

### Epic A. Authentication & Workspace

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-101 | Splash/Login 화면 레이아웃 구현 | FE | 로고, 로그인 버튼, 이메일 폼 배치 |
| FORG-102 | Google 로그인 연동 | BE | OAuth 인증 플로우 구현 |
| FORG-103 | Microsoft 로그인 연동 | BE | OAuth 인증 플로우 구현 |
| FORG-104 | Enterprise SSO 연동 인터페이스 | BE | OIDC/SAML 브리지 설계 |
| FORG-105 | `/me` API 구현 | BE | 사용자/워크스페이스/권한 반환 |
| FORG-106 | 로그인 후 역할 기반 메뉴 렌더링 | FE | Sidebar 가시성 제어 |

### Epic B. Dashboard Core

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-201 | Main Dashboard 3-패널 와이어프레임 반영 | FE | Sidebar, Main, Output Panel |
| FORG-202 | Chat Composer 컴포넌트 구현 | FE | 입력, 실행, 상태 표시 |
| FORG-203 | Session History 패널 구현 | FE | 최근 대화 세션 목록 |
| FORG-204 | chat session 생성 API | BE | `POST /chat/sessions` |
| FORG-205 | message 전송 API | BE | `POST /chat/sessions/{id}/messages` |

### Epic C. Prompt Intelligence

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-301 | Prompt Compare UI 구현 | FE | 원문 vs 정제본 비교 |
| FORG-302 | prompt refine API 구현 | BE | `POST /prompts/refine` |
| FORG-303 | prompt compare API 구현 | BE | `POST /prompts/compare` |
| FORG-304 | 추천 예제 레일 UI 구현 | FE | 유사 템플릿/에이전트 표시 |
| FORG-305 | recommendation API 구현 | BE | 유사 자산 추천 응답 |

### Epic D. Catalog Reuse

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-401 | Agent Catalog 목록 UI 구현 | FE | 검색, 필터, 카드/리스트 |
| FORG-402 | App Catalog 목록 UI 구현 | FE | 프리뷰 포함 |
| FORG-403 | Catalog Rollup Detail 구현 | FE | 상세 정보 + 액션 |
| FORG-404 | catalog items list API | BE | `GET /catalog/items` |
| FORG-405 | catalog item detail API | BE | `GET /catalog/items/{id}` |
| FORG-406 | clone item API | BE | `POST /catalog/items/{id}/clone` |
| FORG-407 | move item API | BE | `POST /catalog/items/{id}/move` |
| FORG-408 | delete item API | BE | `DELETE /catalog/items/{id}` |

### Epic E. Builder Lite

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-501 | Builder 화면 구조 구현 | FE | 설정, 편집, 테스트 패널 |
| FORG-502 | agent draft 생성 API | BE | `POST /build/agents` |
| FORG-503 | app draft 생성 API | BE | `POST /build/apps` |
| FORG-504 | test run API | BE | `POST /build/{type}/{id}/test-run` |
| FORG-505 | publish API | BE | `POST /build/{type}/{id}/publish` |

### Epic F. Multimodal Output

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-601 | Output Panel 탭 구조 구현 | FE | Text/Table/CSV/Image/SVG/Charts |
| FORG-602 | 표 결과 렌더러 구현 | FE | 테이블 렌더링 |
| FORG-603 | CSV 다운로드 처리 | FE/BE | 메타데이터 + 다운로드 |
| FORG-604 | 이미지 뷰어 및 다운로드 구현 | FE | 줌, 미리보기, 저장 |
| FORG-605 | SVG 렌더링 API 검증 및 구현 | BE | 외부 서비스 필요 여부 확인 포함 |
| FORG-606 | 2D 차트 렌더러 구현 | FE | Plotly/ECharts 연동 |
| FORG-607 | 3D 차트 렌더러 구현 | FE | 3D scatter/surface 지원 |
| FORG-608 | artifact metadata API | BE | `GET /artifacts/{id}` |
| FORG-609 | artifact download API | BE | `GET /artifacts/{id}/download` |

### Epic G. Governance & Admin

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-701 | Admin Console Lite 구현 | FE | KPI, 승인 큐, 로그 탭 |
| FORG-702 | approvals list API | BE | `GET /admin/approvals` |
| FORG-703 | approve/reject API | BE | 승인 상태 변경 |
| FORG-704 | audit log API | BE | `GET /admin/audit-logs` |
| FORG-705 | action audit emitter 구현 | BE | clone/move/delete/publish 기록 |

### Epic H. Data Platform Foundation

| 티켓 ID | 제목 | 유형 | 설명 |
|---|---|---|---|
| FORG-801 | Dataset Registry 스키마 생성 | BE/DB | 데이터셋 등록 구조 |
| FORG-802 | 제조 공개 데이터 적재 파이프라인 초안 | Data | Bronze ingest |
| FORG-803 | synthetic HR 데이터 적재 | Data | 샘플 생성 및 적재 |
| FORG-804 | synthetic Finance 데이터 적재 | Data | 샘플 생성 및 적재 |
| FORG-805 | vectorizing pipeline 구현 | Data | chunking, embedding, indexing |
| FORG-806 | dataset binding API | BE | 자산-데이터셋 연결 |

## 5. 스프린트 배치 제안

MoSCoW나 핵심 기능 우선순위 방식처럼, MVP에서는 꼭 필요한 기능을 먼저 묶고 장식적 기능을 뒤로 미루는 접근이 중요하다.[cite:180]

| Sprint | 목표 | 포함 티켓 예시 |
|---|---|---|
| Sprint 1 | 로그인과 기본 대시보드 | FORG-101~106, FORG-201~203 |
| Sprint 2 | 챗 실행과 프롬프트 정제 | FORG-204~205, FORG-301~305 |
| Sprint 3 | 카탈로그 조회와 재사용 | FORG-401~408 |
| Sprint 4 | 빌더 Lite와 테스트 실행 | FORG-501~505 |
| Sprint 5 | 멀티모달 출력과 다운로드 | FORG-601~609 |
| Sprint 6 | 관리자/거버넌스 + 데이터 기반 | FORG-701~705, FORG-801~806 |

## 6. 실행 우선순위 메모

- 화면 설계는 와이어프레임을 기준으로 먼저 고정한다.[cite:170][cite:172]
- API는 OpenAPI 초안을 빠르게 만들고 프론트/백엔드가 동시에 진행한다.[cite:175]
- ERD는 카탈로그, 실행, 아티팩트, 감사 로그를 우선 확정한다.
- 백로그는 90일 이내 착수 가능한 항목 위주로 유지하고, 나머지는 아이디어 뱅크로 분리하는 편이 효율적이다.[cite:178]

## 다음 단계

이 패키지 문서를 바탕으로 바로 이어질 수 있는 다음 실무 산출물은 다음 두 가지다.

- **OpenAPI YAML 상세 문서**: 실제 request/response schema와 example payload 포함.[cite:175]
- **ERD 상세 스키마 문서**: PostgreSQL 기준 테이블, 인덱스, 관계 제약 포함.

가장 추천되는 다음 순서는 **OpenAPI YAML 상세 문서 → ERD 상세 스키마 문서**다. 프론트엔드와 백엔드 병렬 개발을 시작하려면 API 계약을 먼저 고정하는 편이 효과적이기 때문이다.[cite:175][cite:180]
