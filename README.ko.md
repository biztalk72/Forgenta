# Forgenta — 하이브리드 에이전틱 AI 앱 플랫폼

> RAG 기반 채팅, 에이전트 카탈로그, 프롬프트 관리를 갖춘 엔터프라이즈 AI 플랫폼.  
> AWS ECS Fargate + CPU 전용 Ollama 추론 환경에 배포됩니다.

[English Docs →](./README.md)

---

## 개요

Forgenta는 사내 제조·HR·재무 데이터를 위한 하이브리드 에이전틱 AI 플랫폼입니다. 스트리밍 RAG 채팅 인터페이스, 에이전트/앱 카탈로그, 프롬프트 정제 엔진을 제공하며, Ollama로 구동되는 로컬 LLM을 기반으로 동작합니다.

```
사용자 → React 프론트엔드
            ↓
      FastAPI 백엔드  ←→  ChromaDB (벡터 검색)
            ↓
      Ollama LLM (qwen3:0.6b)  ←→  nomic-embed-text
            ↓
      시드 데이터 (제조 / HR / 재무 JSON)
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 19, Vite 8, Tailwind CSS 4, React Router 7, Recharts |
| 백엔드 | FastAPI 0.115, Python 3.12, Uvicorn |
| LLM | Ollama (`qwen3:0.6b` — CPU 최적화 소형 모델) |
| 임베딩 | Ollama (`nomic-embed-text`) |
| 벡터 DB | ChromaDB 0.6 (인메모리, AWS에서는 EFS 마운트) |
| 컨테이너 | Docker, Docker Compose |
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
│   │   ├── prompt.py         # POST /api/prompt/refine|similar|save
│   │   └── catalog.py        # GET/POST /api/catalog/agents|apps
│   ├── services/
│   │   ├── llm.py            # Ollama 채팅 + 프롬프트 정제
│   │   ├── vector.py         # ChromaDB 임베딩 + 검색
│   │   └── data_seed.py      # JSON 시드 데이터 로더
│   └── data/
│       ├── manufacturing.json  # 제조 도메인 (불량률, 설비, 재고)
│       ├── hr.json             # HR 도메인 (인원, 채용, 만족도)
│       └── finance.json        # 재무 도메인 (매출, 예산, 비용)
├── frontend/
│   └── package.json          # React + Vite + Tailwind (src/ 구현 예정)
├── ollama/
│   ├── Dockerfile            # Ollama 이미지 (최초 실행 시 모델 자동 다운로드)
│   └── entrypoint.sh         # qwen3:0.6b + nomic-embed-text 풀 스크립트
├── infra/
│   ├── deploy.sh             # 빌드 → ECR 푸시 → ECS 배포 자동화
│   └── ecs/
│       └── task-definition.json  # Fargate 4vCPU/16GB, EFS 볼륨 설정
├── Dockerfile                # FastAPI 컨테이너 (python:3.12-slim)
└── docker-compose.yml        # 로컬 개발: api + ollama 사이드카
```

---

## 로컬 개발 환경

### 사전 요구사항
- Docker Desktop 설치
- Python 3.12 이상 (Docker 없이 실행 시)

### Docker Compose로 실행 (권장)

```bash
git clone https://github.com/biztalk72/Forgenta.git
cd Forgenta
docker compose up --build
```

- API 서버: http://localhost:8000
- Ollama: http://localhost:11434
- Swagger 문서: http://localhost:8000/docs

> 최초 실행 시 `qwen3:0.6b`(~500MB)와 `nomic-embed-text`(~270MB) 모델을 자동으로 다운로드합니다. 이후 실행부터는 캐시된 볼륨을 사용합니다.

### Docker 없이 백엔드만 실행

```bash
cd backend
pip install -r requirements.txt
# Ollama가 로컬에서 실행 중이어야 합니다: https://ollama.com
uvicorn backend.main:app --reload
```

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
POST /api/prompt/refine    요청: { "text": "..." }   — 프롬프트 정제
POST /api/prompt/similar   요청: { "text": "..." }   — 유사 프롬프트 검색
POST /api/prompt/save      요청: { "text": "...", "metadata": {} }  — 저장
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

배포 스크립트는 다음 순서로 동작합니다:
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

# 콘솔에서 확인
# https://console.aws.amazon.com/ecs/home?region=ap-northeast-2#/clusters/forgenta/services
```

---

## 버그 수정 이력 (2026-04-14)

이번 릴리즈에서 수정된 주요 버그:

| 버그 | 증상 | 수정 내용 |
|------|------|-----------|
| 비동기 스트리밍 차단 | Ollama 동기 스트림이 이벤트 루프를 블로킹 | `asyncio.Queue` + `run_in_executor`로 스레드 분리 |
| CORS 잘못된 설정 | `allow_origins=["*"]` + `credentials=True` → 브라우저에서 거부 | 명시적 localhost 오리진으로 변경 |
| 404 응답 오류 | 튜플 반환 `return {...}, 404`은 FastAPI에서 200으로 처리 | `HTTPException(status_code=404)` 사용으로 수정 |
| `import json` 루프 내부 | 매 요청마다 모듈 재임포트 | 모듈 최상단으로 이동 |

---

## 알려진 제한사항

| 항목 | 내용 |
|------|------|
| 추론 속도 | Fargate CPU 전용 환경: ~5–15초/토큰. 내부 업무용으로는 허용 가능 수준. |
| ChromaDB | 태스크 재시작 시 데이터 초기화. 운영 환경에서는 EFS 영구 마운트 또는 관리형 벡터 DB 전환 필요. |
| 카탈로그 | 인메모리 저장 — 데이터베이스 미연동. |
| 프론트엔드 | `src/` 미구현 (package.json 스캐폴드만 존재). |
| 인증 | 인증 레이어 없음. 외부 공개 전 Cognito 또는 JWT 추가 필요. |

---

## 로드맵

- [ ] 프론트엔드: Chat, Catalog, Builder, Dashboard 페이지 구현
- [ ] ChromaDB EFS 영구 마운트 또는 OpenSearch Serverless 전환
- [ ] 인증 추가 (AWS Cognito / JWT)
- [ ] HTTPS 설정: ACM 인증서 + ALB HTTPS 리스너
- [ ] CI/CD: GitHub Actions → ECR → ECS 롤링 배포
- [ ] 카탈로그 영구화: PostgreSQL (RDS)
- [ ] 모델 업그레이드: 운영 품질을 위해 AWS Bedrock (Claude) 전환 검토

---

## 라이선스

MIT
