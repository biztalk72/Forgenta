# 제조 특화 AiU 플랫폼 MVP

## 프로젝트 개요

본 프로젝트는 식품·제조 공장의 HACCP·품질·설비·생산 데이터를 통합하고, 현업이 자연어와 no-code로 AI 에이전트·업무 앱을 직접 만들고 운영할 수 있는 온프레미스/어플라이언스형 "제조 특화 AiU 플랫폼"입니다.

## 기술 스택

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM**: SQLAlchemy / SQLModel
- **Database**: PostgreSQL 15+ (with pgvector)
- **Graph DB**: Neo4j 5.x
- **Cache**: Redis 7.x
- **AI/ML**: LangChain, LangGraph, vLLM

### Frontend
- **Framework**: Next.js 14+ (React 18+)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS 3.x
- **State Management**: Zustand / React Query

### Infrastructure
- **Container**: Docker, Docker Compose
- **Orchestration**: Kubernetes (k3s for dev)
- **Auth**: Keycloak 23+
- **Policy**: Open Policy Agent (OPA)
- **Monitoring**: Prometheus, Grafana, Loki
- **Workflow**: n8n (self-hosted)

## 프로젝트 구조

```
aiu-platform-mvp/
├── backend/                 # FastAPI 백엔드
│   ├── app/
│   │   ├── api/            # API 엔드포인트
│   │   ├── models/         # 데이터 모델 (SQLAlchemy)
│   │   ├── services/       # 비즈니스 로직
│   │   ├── agents/         # AI 에이전트 구현
│   │   └── core/           # 설정, 인증, 유틸리티
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/           # App Router
│   │   ├── components/    # React 컴포넌트
│   │   └── lib/           # 유틸리티, API 클라이언트
│   ├── package.json
│   └── Dockerfile
├── docker/                 # Docker 설정
│   └── docker-compose.yml
├── k8s/                    # Kubernetes 매니페스트
│   ├── backend/
│   ├── frontend/
│   └── infra/
└── docs/                   # 문서
    ├── architecture_design.md
    ├── tech_stack_recommendation.md
    └── data_model_and_ontology.md
```

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Python 3.11+
- Node.js 22+
- PostgreSQL 15+
- Neo4j 5.x

### 로컬 개발 환경 설정

1. 저장소 클론 및 디렉토리 이동
```bash
cd aiu-platform-mvp
```

2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 필요한 환경 변수 설정
```

3. Docker Compose로 인프라 시작
```bash
docker-compose up -d postgres neo4j redis keycloak
```

4. 백엔드 실행
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. 프론트엔드 실행
```bash
cd frontend
pnpm install
pnpm dev
```

## 주요 기능

### 1. 도메인 에이전트 (PoC 범위)
- HACCP 코파일럿
- CCP 자동기록·이탈 분석
- 품질 불량·클레임 분석
- 설비 이상 패턴·예방 보전

### 2. 플랫폼 기능
- 통합 인증 (Keycloak SSO)
- 역할 기반 접근 제어 (RBAC + OPA)
- 에이전트 생애주기 관리
- 감사 로그 및 모니터링
- No-code 워크플로우 (n8n)
- 서버측 브라우저 자동화 (Playwright)

### 3. AI/데이터 기능
- Graph-RAG (Neo4j + pgvector)
- 자연어 기반 에이전트 생성
- 도메인 온톨로지 기반 지식 탐색

## 라이선스

Proprietary - All Rights Reserved
