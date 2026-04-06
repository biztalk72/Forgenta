# Forgenta v1.2 화면 IA + User Flow 문서

## 문서 목적

본 문서는 Forgenta v1.2를 MVP 수준으로 구현하기 위한 첫 번째 설계 문서로서, 화면 정보구조(Information Architecture)와 핵심 사용자 흐름(User Flow)을 정의한다. Forgenta는 카탈로그 기반 재사용, 멀티모달 출력, 대시보드형 운영 UX, 엔터프라이즈 인증 및 거버넌스를 갖춘 하이브리드 에이전틱 AI 앱 플랫폼으로 정의되므로, IA 역시 단순 챗 화면이 아니라 “탐색-비교-실행-운영”을 자연스럽게 연결하는 구조여야 한다.[cite:145][cite:150][cite:148]

대시보드형 엔터프라이즈 제품에서는 복잡한 기능을 모두 첫 화면에 나열하기보다, 역할 기반 정보 구조와 지속적인 내비게이션, 그리고 필요한 순간에 열리는 사이드 패널·모달·드로어 조합이 사용성을 높인다.[cite:148][cite:150] 따라서 Forgenta는 3-패널 메인 대시보드를 중심으로, 카탈로그와 편집 기능은 오버레이 계층에서 빠르게 열고 닫을 수 있게 설계한다.[cite:145][cite:151]

## 설계 원칙

### 1. Search before build

사용자는 새 앱이나 에이전트를 만들기 전에 기존 예제를 먼저 검색해야 한다. 카탈로그 기반 재사용은 중복 개발을 줄이고 검증된 자산의 재활용을 촉진하므로 메인 흐름 안에 기본 단계로 포함되어야 한다.[cite:145][cite:150]

### 2. Input and output separation

챗 입력과 멀티모달 결과는 같은 화면 안에 있되, 정신적으로는 다른 작업대처럼 구분되어야 한다. 사용자는 질문을 던지는 순간보다, 결과를 보고 비교하고 다운로드하고 다음 행동을 결정하는 순간에 더 오래 머무르기 때문이다.[cite:142][cite:145]

### 3. Overlay for action, not navigation

편집, 삭제, 이동, 상세 보기 같은 작업은 모달·사이드 패널·드로어에서 수행하고, 페이지 전체 전환은 최소화한다. 엔터프라이즈 대시보드에서는 작업 맥락을 유지하는 것이 효율과 오류 감소에 중요하다.[cite:145][cite:150]

### 4. Role-aware visibility

관리자, 파워 유저, 일반 사용자는 같은 제품을 보더라도 다른 액션을 보아야 한다. 역할 기반 설계는 보안뿐 아니라 인터페이스 단순화에도 유리하다.[cite:150][cite:128]

## 사용자 유형

| 사용자 유형 | 핵심 목표 | 주요 화면 |
|---|---|---|
| 일반 사용자 | 질문, 예제 탐색, 실행, 결과 다운로드 | Dashboard, Catalog, Result Viewer |
| 시민개발자/파워 유저 | 프롬프트 비교, 예제 복제, 수정, 새 에이전트 구성 | Dashboard, Catalog Detail, Builder |
| 관리자 | 권한, 승인, 삭제/이동, 로그 검토 | Admin Console, Catalog, Audit View |

## 상위 IA

Forgenta의 상위 정보구조는 6개 1차 영역으로 구성한다.[cite:148][cite:150]

| 1차 메뉴 | 목적 | 주요 하위 영역 |
|---|---|---|
| Splash / Login | 로그인 및 진입 | Google, Microsoft, SSO, Email |
| Main Dashboard | 일상 작업 허브 | Chat, Prompt Compare, Recommendations, Result Viewer |
| Agent Catalog | 에이전트 탐색/사용/편집 | Cards, List, Detail Panel, Actions |
| App Catalog | 앱 탐색/실행/관리 | Cards, List, Detail Panel, Actions |
| Builder / Editor | 앱/에이전트 수정 및 생성 | Prompt, Data Source, Output, Guardrails |
| Admin Console | 거버넌스 및 운영 | Users, Roles, Datasets, Audit, Approval |

## 화면 구조 상세

### 1. Splash / Login

첫 화면은 브랜드 신뢰와 진입 단순성을 동시에 담당한다. 인증 방식이 여러 갈래여도 사용자는 “하나의 시작 화면”에서 선택해야 하며, 특히 민감 데이터가 있는 엔터프라이즈 환경에서는 SSO와 역할 기반 진입 설계가 중요하다.[cite:144][cite:150]

필수 컴포넌트:
- Forgenta 로고와 한 줄 설명.
- Google 로그인 버튼.
- Microsoft 로그인 버튼.
- Enterprise SSO 버튼.
- Email 로그인 폼.
- 개인정보/보안 안내 링크.

### 2. Main Dashboard

메인 대시보드는 Forgenta의 운영 중심이다. 좌측 내비게이션은 깊은 기능 구조에서 발견성을 높이고, 중앙은 입력과 비교, 우측은 멀티모달 출력과 아티팩트 소비를 담당하는 구조가 적합하다.[cite:148][cite:145]

기본 레이아웃:
- 좌측 Sidebar: Home, Agent Catalog, App Catalog, Builder, Datasets, Admin, Recent, Favorites.
- 상단 Top Bar: 로고, 글로벌 검색, 워크스페이스 스위처, 알림, 프로필 메뉴.
- 중앙 Workspace: 챗 입력, 히스토리, 정제 프롬프트 비교, 추천 예제.
- 우측 Output Panel: Text, Table, CSV, Image, SVG, 2D Chart, 3D Chart 탭.

### 3. Agent Catalog

Agent Catalog는 사용 가능한 업무용 에이전트를 탐색하고 재사용하는 공간이다. 복잡한 SaaS 인터페이스에서 카드와 리스트 뷰를 모두 제공하면 초보자와 고급 사용자 모두에게 유리하다.[cite:145][cite:150]

핵심 구성:
- 검색창.
- 필터: 도메인, 상태, 소유자, 공개범위, 데이터 소스.
- 정렬: 최신순, 인기순, 평점순, 최근 사용순.
- 카드/리스트 토글.
- 항목 클릭 시 우측 롤업 상세 패널.
- 액션: Use, Edit, Clone, Delete, Move.

### 4. App Catalog

App Catalog는 에이전트보다 더 UI 지향적인 결과물을 위한 공간이다. 사용자는 특정 분석 앱이나 결과 뷰어 앱을 선택해 실행하거나 대시보드에 배치할 수 있어야 한다.[cite:145][cite:151]

핵심 구성은 Agent Catalog와 유사하되, 추가로 다음을 포함한다.
- 샘플 화면 프리뷰.
- 위젯/차트 타입 정보.
- 대시보드에 Pin/Add 액션.

### 5. Builder / Editor

Builder는 “빈 화면에서 시작”보다는 “예제에서 시작해 수정”하는 흐름을 기본값으로 가져야 한다. 시각적 플로우 빌더와 버전/복제 기능은 복잡한 워크플로우를 다루는 환경에서 유지보수성과 이해 가능성을 높인다.[cite:152][cite:147]

핵심 탭:
- Prompt.
- Data Sources.
- Outputs.
- Guardrails.
- Version / Publish.

### 6. Admin Console

관리자는 일반 사용자와 다른 작업을 수행하므로, 관리 기능은 별도 콘솔로 분리하는 편이 적절하다. 거버넌스 대시보드는 가시성, 감사 가능성, 정책 준수 여부를 한눈에 보여주는 구성이 중요하다.[cite:128][cite:146]

핵심 영역:
- User & Role Management.
- Dataset Registry.
- Prompt / Agent Approval Queue.
- Audit Logs.
- Usage & Health Dashboard.

## 전역 내비게이션 구조

전역 내비게이션은 “자주 쓰는 것에 빠르게 접근”하게 해주는 도로망과 같다. 사이드바는 기능이 많은 플랫폼에서 지속적 발견성과 빠른 전환에 유리하므로 Forgenta에 적합하다.[cite:148]

권장 구조:
- Primary Navigation: Sidebar 고정.
- Secondary Navigation: Top Bar 드롭다운, 검색, 사용자 메뉴.
- Contextual Navigation: 상세 패널 내부 탭, Builder 내부 탭.
- Transient Layer: Modal, Drawer, Rollup Panel.

## 핵심 사용자 흐름

### Flow 1. 로그인 후 첫 진입

목표는 사용자를 “무엇을 해야 할지 모르는 상태”에서 “질문을 시작하거나 예제를 찾을 수 있는 상태”로 빠르게 이동시키는 것이다. 온보딩 흐름은 초기 이탈을 줄이기 위해 짧고 분기점이 명확해야 한다.[cite:144]

흐름:
1. Splash / Login 진입.
2. 로그인 방식 선택.
3. 성공 시 Workspace/Role 확인.
4. Main Dashboard 진입.
5. 추천 예제 또는 최근 항목 노출.

### Flow 2. 자유 입력 → 프롬프트 정제 → 실행

이 흐름은 Forgenta의 핵심이다. 사용자는 원문을 던지고, 시스템은 그것을 더 좋은 질문으로 다듬고, 유사 사례를 보여준 뒤 실행하게 해야 한다.[cite:145][cite:150]

흐름:
1. Dashboard에서 질문 입력.
2. 정제 프롬프트 생성.
3. 원문 vs 정제본 비교 표시.
4. 유사 프롬프트/에이전트/앱 추천.
5. 바로 실행 또는 예제 선택.
6. 결과를 Output Panel에 렌더링.
7. 다운로드/저장/복제/피드백 수행.

### Flow 3. 카탈로그 탐색 → 사용

카탈로그는 앱 서랍처럼 작동해야 한다. 사용자는 탐색 중 길을 잃지 않아야 하며, 상세 정보와 실행 액션이 가깝게 배치되어야 한다.[cite:145][cite:151]

흐름:
1. Sidebar에서 Agent Catalog 또는 App Catalog 클릭.
2. 목록 탐색 또는 검색.
3. 필터/정렬 적용.
4. 항목 선택.
5. 롤업 상세 패널 오픈.
6. Use 클릭.
7. 실행 결과를 Dashboard 또는 Result Viewer에서 확인.

### Flow 4. 예제 복제 → 수정 → 실행

복제 흐름은 “새로 만들기보다 안전한 시작점에서 출발하게 하는” 기능이다. 워크플로우 빌더에서 버전과 복제는 복잡성을 줄이는 핵심 장치로 쓰인다.[cite:152]

흐름:
1. Catalog Detail에서 Clone 클릭.
2. 새 이름 자동 제안.
3. Builder/Edit 화면 진입.
4. Prompt, Data Source, Output 설정 수정.
5. Preview / Test Run.
6. Save Draft.
7. Publish 또는 개인 저장.

### Flow 5. 삭제 및 이동

삭제와 이동은 강한 액션이므로, 맥락을 유지하면서도 명확한 확인 절차를 가져야 한다. 엔터프라이즈 제품에서는 실수 방지를 위해 모달과 드로어를 조합하는 방식이 흔하다.[cite:145][cite:150]

흐름:
1. Catalog Detail 또는 목록 액션 메뉴에서 Delete/Move 선택.
2. Delete는 확인 모달 표시.
3. Move는 대상 Workspace/Folder/Category를 고르는 Drawer 오픈.
4. 권한 검사.
5. 성공 메시지와 Audit 기록 생성.

### Flow 6. 멀티모달 결과 소비

Forgenta의 결과 화면은 단순 답변창이 아니라 작업대다. 사용자는 결과를 읽는 것보다 검토, 비교, 다운로드, 후속 액션으로 더 많이 이어져야 한다.[cite:142][cite:145]

흐름:
1. 질의 또는 앱 실행 완료.
2. Output Panel에 결과 타입별 탭 노출.
3. Text/Table/CSV/Image/SVG/Chart 중 해당 타입 활성화.
4. 사용자는 확대, 다운로드, 대시보드 핀, 후속 실행 중 하나 선택.
5. 필요 시 결과를 새 앱/에이전트 입력으로 재사용.

### Flow 7. 관리자 승인

거버넌스 흐름은 일반 사용자의 생산성을 해치지 않으면서도 위험을 통제해야 한다. AI 거버넌스 대시보드는 승인 대기, 정책 위반, 사용량, 오너십 상태를 빠르게 보여줄 필요가 있다.[cite:128][cite:146]

흐름:
1. 관리자 로그인.
2. Approval Queue 진입.
3. Draft/Review 상태의 Prompt, Agent, App 확인.
4. 상세 검토.
5. Approve / Reject / Request Change.
6. 상태 변경과 Audit 기록.

## 화면 간 관계

Forgenta 화면은 섬처럼 따로 존재하면 안 된다. 정보 구조는 “질문 → 예제 탐색 → 수정 → 실행 → 관리”가 하나의 연속된 순환처럼 연결되어야 한다.[cite:145][cite:150]

권장 연결 관계:
- Splash/Login → Main Dashboard.
- Main Dashboard ↔ Agent Catalog.
- Main Dashboard ↔ App Catalog.
- Catalog Detail → Builder / Editor.
- Builder / Editor → Test Run → Output Panel.
- Admin Console ↔ Catalog / Approval Items.

## 권한별 액션 가시성

| 액션 | 일반 사용자 | 파워 유저 | 관리자 |
|---|---|---|---|
| Use / Run | 가능 | 가능 | 가능 |
| Clone | 가능 | 가능 | 가능 |
| Edit | 제한적 또는 본인 소유만 | 가능 | 가능 |
| Delete | 불가 또는 본인 소유만 | 제한적 | 가능 |
| Move | 불가 | 제한적 | 가능 |
| Approve | 불가 | 불가 | 가능 |

역할 기반 액션 노출은 보안을 위한 것만이 아니라, 인터페이스의 복잡도를 줄이는 효과도 있다.[cite:150]

## 오버레이 패턴 정의

Forgenta는 한 번에 너무 많은 페이지 전환을 일으키면 안 된다. 따라서 다음 규칙을 권장한다.[cite:145][cite:150]

- **Rollup Panel**: 카탈로그 상세 보기, 빠른 프리뷰, 속성 확인.
- **Drawer**: 이동(Move), 고급 필터, 결과 설정.
- **Modal**: 삭제 확인, 승인 확인, 치명적 경고.
- **Full Page**: Builder, Admin Console, 복잡한 설정 작업.

## MVP 우선 화면

MVP에서 반드시 먼저 설계하고 구현해야 할 화면은 다음과 같다.[cite:145][cite:151]

1. Splash / Login.
2. Main Dashboard.
3. Agent Catalog.
4. App Catalog.
5. Catalog Detail Rollup.
6. Builder / Editor Lite.
7. Admin Console Lite.

## 설계 체크리스트

- 사용자가 첫 진입 후 1분 내 질문 또는 예제 실행을 시작할 수 있는가.[cite:144]
- 챗 입력과 결과 확인이 한 화면에서 자연스럽게 연결되는가.[cite:145]
- 카탈로그 액션이 과도한 페이지 이동 없이 수행되는가.[cite:150]
- 역할별로 불필요한 액션이 숨겨지는가.[cite:150]
- 관리자 화면이 운영 상태와 승인 큐를 빠르게 보여주는가.[cite:128]
- 멀티모달 결과가 보기, 저장, 재사용까지 이어지는가.[cite:142]

## 다음 단계 산출물

이 문서를 기준으로 바로 이어서 도출할 수 있는 다음 산출물은 다음과 같다.

- 화면별 와이어프레임 초안.
- 시스템 아키텍처 문서.
- API 리소스 목록 및 명세 초안.
- MVP 개발 백로그와 스프린트 분해.

특히 시스템 아키텍처 문서는 이 IA를 바탕으로 “어떤 화면이 어떤 서비스와 데이터를 호출하는가”를 대응시키는 문서가 되어야 한다. 그렇게 해야 기능 구조와 기술 구조가 어긋나지 않는다.[cite:127][cite:137]
