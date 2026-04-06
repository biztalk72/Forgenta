# 제조 특화 AiU 플랫폼 MVP - 프로젝트 개요

## 프로젝트 소개

본 프로젝트는 제공된 PRD(Product Requirements Document)를 기반으로 설계 및 구현된 **제조 특화 AiU 플랫폼 MVP**입니다. 식품 및 제조 공장의 HACCP, 품질, 설비, 생산 데이터를 통합하고, 현업 담당자가 자연어와 no-code 방식으로 AI 에이전트와 업무 앱을 직접 만들고 운영할 수 있는 온프레미스/어플라이언스형 플랫폼입니다.

## 핵심 특징

본 플랫폼은 다음과 같은 핵심 특징을 가지고 있습니다.

**도메인 특화 AI 에이전트**: HACCP 코파일럿, CCP 이탈 분석, 품질 불량 분석, 설비 예방 보전 등 제조 현장의 실제 업무에 특화된 AI 에이전트를 제공합니다. 각 에이전트는 LangChain 및 LangGraph를 기반으로 구현되어 복잡한 워크플로우를 처리할 수 있습니다.

**Graph-RAG 기반 지식 탐색**: 단순한 키워드 검색을 넘어, Neo4j 그래프 데이터베이스에 구축된 도메인 온톨로지와 pgvector 기반 벡터 검색을 결합한 Graph-RAG를 통해 사용자의 질문 의도를 정확히 파악하고 관련 정보를 구조적으로 탐색합니다. 이를 통해 더욱 정확하고 맥락에 맞는 답변을 생성할 수 있습니다.

**강력한 거버넌스 및 보안**: Keycloak을 통한 통합 인증 및 역할 기반 접근 제어(RBAC), OPA(Open Policy Agent)를 통한 세분화된 정책 관리, 그리고 모든 활동에 대한 감사 로그 기록을 통해 'Shadow IT/AI'를 방지하고 엔터프라이즈 수준의 거버넌스를 제공합니다.

**No-code 워크플로우 자동화**: n8n을 내장하여 관리자 및 파워유저가 GUI 기반으로 데이터 처리, 리포팅, 알림 등의 자동화 워크플로우를 직접 구성할 수 있습니다. 또한 Playwright를 활용한 서버측 브라우저 자동화를 통해 레거시 시스템에서 데이터를 추출하고 통합할 수 있습니다.

**온프레미스 배포 최적화**: 모든 컴포넌트가 Docker 컨테이너로 패키징되고 Kubernetes를 통해 오케스트레이션되어, 고객사의 온프레미스 또는 프라이빗 클라우드 환경에 일관되고 안정적으로 배포할 수 있습니다. 데이터는 고객 인프라 내에서만 저장 및 처리되어 보안 요구사항을 충족합니다.

## 제공된 산출물

본 프로젝트는 다음과 같은 산출물을 포함하고 있습니다.

### 1. 설계 문서

-   **architecture_design.md**: 시스템 전체 아키텍처 설계, 컴포넌트 구성, 데이터 흐름, 아키텍처 결정 근거 등을 상세히 기술한 문서입니다.
-   **tech_stack_recommendation.md**: 각 컴포넌트별 추천 기술 스택 및 프레임워크, 선정 근거, 대안 기술에 대한 비교 분석을 포함한 문서입니다.
-   **data_model_and_ontology.md**: PostgreSQL 관계형 데이터 모델(ERD 포함)과 Neo4j 그래프 데이터 모델(온톨로지 스키마)을 정의한 문서입니다.

### 2. 구현 코드

-   **Backend (FastAPI)**: `/backend` 디렉토리에 FastAPI 기반 백엔드 애플리케이션의 전체 코드가 포함되어 있습니다.
    -   `/app/main.py`: FastAPI 메인 애플리케이션 진입점
    -   `/app/core/`: 설정, 데이터베이스 연결 등 핵심 모듈
    -   `/app/models/`: SQLAlchemy ORM 모델 및 Pydantic 스키마
    -   `/app/api/`: REST API 엔드포인트 라우터
    -   `/app/services/`: RAG, 그래프 등 비즈니스 로직 서비스
    -   `/app/agents/`: HACCP 코파일럿 등 AI 에이전트 구현
    -   `requirements.txt`: Python 의존성 패키지 목록

### 3. 인프라 및 배포 설정

-   **Docker Compose**: `/docker/docker-compose.yml` 파일을 통해 로컬 개발 환경에서 PostgreSQL, Neo4j, Redis, Keycloak, OPA, n8n, Prometheus, Grafana, Loki 등 전체 인프라 스택을 손쉽게 실행할 수 있습니다.
-   **환경 변수 템플릿**: `.env.example` 파일은 애플리케이션 실행에 필요한 모든 환경 변수의 예시를 제공합니다.

### 4. 운영 가이드

-   **deployment_guide.md**: 로컬 개발 환경 구성부터 Kubernetes 프로덕션 배포, 초기 설정, 모니터링, 백업 및 복구까지 전체 배포 및 운영 프로세스를 단계별로 설명한 가이드입니다.

## 빠른 시작 가이드

### 로컬 환경에서 실행하기

1.  **사전 요구사항 확인**: Docker, Docker Compose, Python 3.11+, Node.js 22+가 설치되어 있어야 합니다.

2.  **환경 변수 설정**:
    ```bash
    cp .env.example .env
    # .env 파일을 편집하여 필요한 값 설정 (특히 LLM_API_KEY)
    ```

3.  **인프라 서비스 실행**:
    ```bash
    cd docker
    docker-compose up -d
    ```

4.  **백엔드 실행**:
    ```bash
    cd ../backend
    pip install -r requirements.txt
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

5.  **API 문서 확인**: 브라우저에서 `http://localhost:8000/api/v1/docs`로 접속하여 Swagger UI를 통해 API를 탐색하고 테스트할 수 있습니다.

## 다음 단계

본 MVP는 PRD에 명시된 핵심 기능의 기반을 구현한 것입니다. 실제 프로덕션 배포를 위해서는 다음 작업들이 추가로 필요합니다.

-   **프론트엔드 개발**: Next.js 기반의 사용자 인터페이스 구현 (채팅 UI, 에이전트 관리 대시보드 등)
-   **추가 에이전트 구현**: CCP 자동기록, 품질 불량 분석, 설비 예방 보전 에이전트 등
-   **Keycloak 통합**: JWT 토큰 검증, 역할 기반 접근 제어 로직 완성
-   **OPA 정책 정의**: 각 에이전트 및 데이터 소스에 대한 접근 제어 정책 작성
-   **Kubernetes Helm Chart**: 프로덕션 배포를 위한 Helm Chart 작성
-   **CI/CD 파이프라인**: GitLab CI/CD 또는 Jenkins를 통한 자동화된 빌드, 테스트, 배포 파이프라인 구축
-   **테스트 코드**: 단위 테스트, 통합 테스트 작성
-   **문서 인덱싱**: 실제 HACCP 문서, SOP, 보고서 등을 RAG 시스템에 인덱싱
-   **온톨로지 데이터 구축**: 실제 공장, 라인, 설비, 공정 등의 데이터를 Neo4j에 구축

## 기술 지원

본 프로젝트에 대한 질문이나 이슈가 있으시면 프로젝트 저장소의 Issues 섹션을 활용해 주시기 바랍니다.
