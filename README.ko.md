# Forgenta — 하이브리드 에이전틱 AI 앱 플랫폼

> RAG 기반 채팅, 에이전트 카탈로그, 프롬프트 관리를 갖춘 엔터프라이즈 AI 플랫폼.  
> React + FastAPI 풀스택, Docker Compose로 컨테이너화, AWS ECS Fargate에 배포됩니다.

[English Docs →](./README.md)

---

## 개요

Forgenta는 사내 제조·HR·재무 데이터를 위한 하이브리드 에이전틱 AI 플랫폼입니다. 스트리밍 RAG 채팅 인터페이스, 에이전트/앱 카탈로그, 프롬프트 정제 엔진을 제공하며, Ollama로 구동되는 로컬 LLM을 기반으로 동작합니다.

```
브라우저 → React 프론트엔드 (nginx :3000)
                ↓ /api/*
          FastAPI 백엔드 (:8000)  ←→  ChromaDB (벡터 검색)
                ↓
          Ollama (:11434)
          ├── qwen3:0.6b        (채팅 + 프롬프트 정제)
          └── nomic-embed-text  (임베딩)
                ↓
          시드 데이터 (제조 / HR / 재무 JSON)
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 19, Vite 8, Tailwind CSS 4, React Router 7, Recharts, lucide-react |
| 백엔드 | FastAPI 0.115, Python 3.12, Uvicorn |
| LLM | Ollama (`qwen3:0.6b` — CPU 최적화 소형 모델) |
| 임베딩 | Ollama (`nomic-embed-text`) |
| 벡터 DB | ChromaDB 0.6 (인메모리, AWS에서는 EFS 마운트) |
| 컨테이너 | Docker, Docker Compose, nginx:alpine |
| 클라우드 | AWS ECS Fargate, ECR, EFS, ALB (ap-northeast-2) |

---

## 프로젝트 구조

```
Forgenta/
├── backend/
│   ├── main.py               # FastAPI 앱, CORS 설정, 시드 데이터 로더
│   ├── requirements.txt
│   ├── routers/
│   │   ├── chat.py           # POST /api/chat/stream, /api/chat/context
│   │   ├── prompt.py         # POST /api/prompt/refine|refine/stream|similar|save
│   │   └── catalog.py        # GET/POST /api/catalog/agents|apps
│   ├── services/
│   │   ├── llm.py            # Ollama 채팅 + 스트리밍 프롬프트 정제
│   │   ├── vector.py         # ChromaDB 임베딩 + 검색
│   │   └── data_seed.py      # JSON 시드 데이터 로더
│   └── data/
│       ├── manufacturing.json  # 제조 도메인 (불량률, 설비, 재고)
│       ├── hr.json             # HR 도메인 (인원, 채용, 만족도)
│       └── finance.json        # 재무 도메인 (매출, 예산, 비용)
├── frontend/
│   ├── Dockerfile            # 멀티스테이지: node:22 빌드 → nginx:alpine 서빙
│   ├── nginx.conf            # SPA 폴백 + /api/ 프록시 (SSE를 위해 버퍼링 비활성화)
│   ├── vite.config.js        # Tailwind v4 플러그인 + 개발 서버 프록시 (:8000)
│   ├── index.html
│   └── src/
│       ├── App.jsx           # React Router 라우트 설정
│       ├── components/
│       │   ├── Layout.jsx    # 다크 사이드바 내비게이션
│       │   ├── ChartBlock.jsx # Recharts 바/라인/파이 차트 렌더러
│       │   └── TableBlock.jsx # 데이터 테이블 렌더러
│       ├── lib/
│       │   ├── api.js        # Fetch 헬퍼 + SSE 스트림용 async generator
│       │   └── parseResponse.js  # json:chart / json:table 블록 추출
│       └── pages/
│           ├── Dashboard.jsx # 헬스 상태, 통계 카드, 인프라 패널, 카탈로그 현황
│           ├── Chat.jsx      # 스트리밍 RAG 채팅 + 차트/테이블 자동 렌더링
│           ├── Catalog.jsx   # 에이전트/앱 검색·필터·복제 모달
│           └── Builder.jsx   # 프롬프트 스트리밍 정제, 유사 검색, 저장
├── ollama/
│   ├── Dockerfile            # Ollama 이미지 (최초 실행 시 모델 자동 다운로드)
│   └── entrypoint.sh         # qwen3:0.6b + nomic-embed-text 풀 스크립트
├── infra/
│   ├── deploy.sh             # 빌드 → ECR 푸시 → ECS 배포 자동화
│   └── ecs/
│       └── task-definition.json  # Fargate 4vCPU/16GB, EFS 볼륨 설정
├── Dockerfile                # FastAPI 컨테이너 (python:3.12-slim)
└── docker-compose.yml        # 풀스택: ollama + api + frontend
```

---

## 로컬 개발 환경

### 사전 요구사항
- Docker Desktop

### Docker Compose로 실행 (권장)

```bash
git clone https://github.com/biztalk72/Forgenta.git
cd Forgenta
docker compose up --build
```

| 서비스 | URL | 설명 |
|--------|-----|------|
| 프론트엔드 | http://localhost:3000 | nginx가 서빙하는 React SPA |
| API | http://localhost:8000 | FastAPI (Swagger: `/docs`) |
| Ollama | http://localhost:11434 | LLM 추론 서버 |

> **최초 실행 시:** `qwen3:0.6b`(~500MB)와 `nomic-embed-text`(~270MB)를 자동으로 다운로드합니다.  
> API 컨테이너는 두 모델이 모두 준비될 때까지 대기합니다 (헬스체크로 보장).  
> 이후 실행부터는 캐시된 `ollama_data` 볼륨을 사용하여 훨씬 빠르게 시작됩니다.

### 프론트엔드 개발 서버 실행 (핫 리로드)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, /api → http://localhost:8000 프록시
```

### Docker 없이 백엔드만 실행

```bash
pip install -r backend/requirements.txt
# Ollama가 로컬에서 실행 중이어야 합니다: https://ollama.com
uvicorn backend.main:app --reload
```

---

## 프론트엔드 페이지

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 대시보드 | `/dashboard` | 헬스 상태 배지, 통계 카드, 인프라 패널, 카탈로그 사용량 TOP 5 |
| 채팅 | `/chat` | 스트리밍 RAG 채팅 — 응답에서 차트·테이블 자동 렌더링 |
| 카탈로그 | `/catalog` | 에이전트/앱 검색·유형/도메인 필터·에이전트 복제 |
| 빌더 | `/builder` | LLM 기반 스트리밍 프롬프트 정제, 유사 프롬프트 검색, 저장 |

---

## API 엔드포인트

### 헬스 체크
```
GET  /api/health
```

### 채팅 (RAG 스트리밍)
```
POST /api/chat/stream
요청: { "message": "CNC 불량률 분석해줘", "history": [] }
응답: text/plain 스트림

POST /api/chat/context
요청: { "message": "..." }
응답: { "context": [{ "id", "title", "domain", "distance" }] }
```

### 프롬프트
```
POST /api/prompt/refine          요청: { "text": "..." }  → { original, refined }
POST /api/prompt/refine/stream   요청: { "text": "..." }  → text/plain 스트림
POST /api/prompt/similar         요청: { "text": "..." }  → { similar: [...] }
POST /api/prompt/save            요청: { "text": "...", "metadata": {} }
```

### 카탈로그
```
GET  /api/catalog/agents                       — 에이전트 목록
GET  /api/catalog/apps                         — 앱 목록
GET  /api/catalog/agents/{id}                  — 에이전트 상세
GET  /api/catalog/apps/{id}                    — 앱 상세
POST /api/catalog/agents/{id}/clone            — 에이전트 복제
     요청: { "name": "...", "description": "..." }
```

---

## Docker Compose 서비스 구성

```yaml
services:
  ollama:    # Ollama LLM 서버 — 최초 실행 시 모델 자동 다운로드
  api:       # FastAPI 백엔드 — ollama 헬시 상태 확인 후 시작
  frontend:  # nginx가 React 빌드 서빙 + /api/ → api:8000 프록시
```

`ollama` 헬스체크는 `nomic-embed-text` 모델이 목록에 나타날 때까지 폴링합니다.  
따라서 `api` 컨테이너는 두 모델이 완전히 다운로드된 후에만 시작됩니다.

---

## 환경 변수

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `qwen3:0.6b` | LLM 모델명 |
| `EMBED_MODEL` | `nomic-embed-text` | 임베딩 모델명 |

---

## AWS 인프라

### 아키텍처

```
인터넷
    ↓
ALB (forgenta-alb) — 80포트
    ↓
ECS Fargate 태스크 (4 vCPU / 16 GB)
    ├── api 컨테이너       (8000포트, FastAPI)
    └── ollama 컨테이너    (11434포트, Ollama)
              ↕
         EFS 볼륨 (fs-01501d53a49e21753)
         /root/.ollama  — 모델 영구 저장
```

### 배포된 AWS 리소스

| 리소스 | ID / 이름 | 리전 |
|--------|-----------|------|
| ECR — API | `forgenta-api` | ap-northeast-2 |
| ECR — Ollama | `forgenta-ollama` | ap-northeast-2 |
| ECS 클러스터 | `forgenta` | ap-northeast-2 |
| ECS 서비스 | `forgenta-api` (desired: 1) | ap-northeast-2 |
| 태스크 정의 | `forgenta:1` (4 vCPU / 16 GB) | ap-northeast-2 |
| EFS | `fs-01501d53a49e21753` | ap-northeast-2 |
| ALB | `forgenta-alb` | ap-northeast-2 |
| 타겟 그룹 | `forgenta-api-tg` (헬스체크: `/api/health`) | ap-northeast-2 |
| IAM 역할 | `ecsTaskExecutionRole` | 글로벌 |
| VPC | `vpc-050cc5e80d526129c` (기본 VPC) | ap-northeast-2 |
| 보안 그룹 | `forgenta-alb-sg` (sg-0b2086e1ffc626270) | ap-northeast-2 |
| 보안 그룹 | `forgenta-ecs-sg` (sg-095fd03756bae3432) | ap-northeast-2 |

### 퍼블릭 엔드포인트

```
http://forgenta-alb-1276967058.ap-northeast-2.elb.amazonaws.com
```

### 신규 버전 배포

```bash
bash infra/deploy.sh           # :latest 태그 사용
bash infra/deploy.sh v1.2.0    # 커스텀 태그 지정
```

배포 스크립트 순서:
1. ECR 로그인
2. Docker 이미지 빌드 (api + ollama)
3. ECR로 이미지 푸시
4. ECS 태스크 정의 등록
5. ECS 서비스 강제 재배포

### 모니터링

```bash
# 서비스 상태 확인
aws ecs describe-services --cluster forgenta --services forgenta-api \
  --region ap-northeast-2 \
  --query 'services[0].{status:status,running:runningCount,pending:pendingCount}'

# 실시간 로그 스트리밍
aws logs tail /ecs/forgenta --follow --region ap-northeast-2
```

---

## 알려진 제한사항

| 항목 | 내용 |
|------|------|
| 추론 속도 | Fargate CPU 전용 환경: ~5–15초/토큰. 내부 업무용으로는 허용 가능 수준. |
| ChromaDB | 태스크 재시작 시 데이터 초기화. 운영 환경에서는 EFS 영구 마운트 또는 관리형 벡터 DB 전환 필요. |
| 카탈로그 | 인메모리 저장 — 데이터베이스 미연동. |
| 인증 | 인증 레이어 없음. 외부 공개 전 Cognito 또는 JWT 추가 필요. |

---

## 로드맵

- [x] 프론트엔드: Dashboard, Chat, Catalog, Builder 페이지 구현
- [x] 스트리밍 프롬프트 정제 (`/api/prompt/refine/stream`)
- [x] Docker Compose 풀스택 (ollama + api + frontend)
- [ ] ChromaDB EFS 영구 마운트 또는 OpenSearch Serverless 전환
- [ ] 인증 추가 (AWS Cognito / JWT)
- [ ] HTTPS 설정: ACM 인증서 + ALB HTTPS 리스너
- [ ] CI/CD: GitHub Actions → ECR → ECS 롤링 배포
- [ ] 카탈로그 영구화: PostgreSQL (RDS)
- [ ] 모델 업그레이드: 운영 품질을 위해 AWS Bedrock (Claude) 전환 검토

---

## 라이선스

MIT
