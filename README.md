# Forgenta — Hybrid Agentic AI App Platform

> Enterprise AI platform with RAG-powered chat, agent catalog, and prompt management.  
> Deployed on AWS ECS Fargate with CPU-only Ollama inference.

[한국어 문서 →](./README.ko.md)

---

## Overview

Forgenta is a hybrid agentic AI platform designed for enterprise internal data — manufacturing, HR, and finance. It provides a streaming RAG chat interface, an agent/app catalog, and a prompt refinement engine, all powered by a local LLM via Ollama.

```
User → React Frontend
         ↓
    FastAPI Backend  ←→  ChromaDB (vector search)
         ↓
    Ollama LLM (qwen3:0.6b)  ←→  nomic-embed-text
         ↓
    Seed Data (manufacturing / HR / finance JSON)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, Recharts |
| Backend | FastAPI 0.115, Python 3.12, Uvicorn |
| LLM | Ollama (`qwen3:0.6b` — CPU-friendly) |
| Embeddings | Ollama (`nomic-embed-text`) |
| Vector DB | ChromaDB 0.6 (in-memory, EFS-backed on AWS) |
| Container | Docker, Docker Compose |
| Cloud | AWS ECS Fargate, ECR, EFS, ALB (ap-northeast-2) |

---

## Project Structure

```
Forgenta/
├── backend/
│   ├── main.py               # FastAPI app, CORS, lifespan seed loader
│   ├── requirements.txt
│   ├── routers/
│   │   ├── chat.py           # POST /api/chat/stream, /api/chat/context
│   │   ├── prompt.py         # POST /api/prompt/refine|similar|save
│   │   └── catalog.py        # GET/POST /api/catalog/agents|apps
│   ├── services/
│   │   ├── llm.py            # Ollama chat + prompt refinement
│   │   ├── vector.py         # ChromaDB embed + search
│   │   └── data_seed.py      # JSON seed loader
│   └── data/
│       ├── manufacturing.json
│       ├── hr.json
│       └── finance.json
├── frontend/
│   └── package.json          # React + Vite + Tailwind (src/ TBD)
├── ollama/
│   ├── Dockerfile            # Ollama image with lazy model pull
│   └── entrypoint.sh         # Pull qwen3:0.6b + nomic-embed-text on first start
├── infra/
│   ├── deploy.sh             # Build → ECR push → ECS deploy
│   └── ecs/
│       └── task-definition.json  # Fargate 4vCPU/16GB, EFS volume
├── Dockerfile                # FastAPI container (python:3.12-slim)
└── docker-compose.yml        # Local dev: api + ollama sidecar
```

---

## Local Development

### Prerequisites
- Docker Desktop
- Python 3.12+ (for running without Docker)

### Run with Docker Compose (recommended)

```bash
git clone https://github.com/biztalk72/Forgenta.git
cd Forgenta
docker compose up --build
```

- API: http://localhost:8000
- Ollama: http://localhost:11434
- Swagger docs: http://localhost:8000/docs

> First start pulls `qwen3:0.6b` (~500MB) and `nomic-embed-text` (~270MB). Subsequent starts use the cached volume.

### Run backend without Docker

```bash
cd backend
pip install -r requirements.txt
# Requires Ollama running locally: https://ollama.com
uvicorn backend.main:app --reload
```

---

## API Endpoints

### Health
```
GET  /api/health
```

### Chat (RAG Streaming)
```
POST /api/chat/stream
Body: { "message": "CNC 불량률 분석해줘", "history": [] }
Response: text/plain stream

POST /api/chat/context
Body: { "message": "..." }
Response: { "context": [{ "id", "title", "domain", "distance" }] }
```

### Prompt
```
POST /api/prompt/refine    Body: { "text": "..." }
POST /api/prompt/similar   Body: { "text": "..." }
POST /api/prompt/save      Body: { "text": "...", "metadata": {} }
```

### Catalog
```
GET  /api/catalog/agents
GET  /api/catalog/apps
GET  /api/catalog/agents/{id}
GET  /api/catalog/apps/{id}
POST /api/catalog/agents/{id}/clone   Body: { "name": "...", "description": "..." }
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen3:0.6b` | LLM model name |
| `EMBED_MODEL` | `nomic-embed-text` | Embedding model name |

---

## AWS Infrastructure

### Architecture

```
Internet
    ↓
ALB (forgenta-alb) — port 80
    ↓
ECS Fargate Task (4 vCPU / 16 GB)
    ├── api container       (port 8000, FastAPI)
    └── ollama container    (port 11434, Ollama)
              ↕
         EFS Volume (fs-01501d53a49e21753)
         /root/.ollama  — model persistence
```

### Deployed Resources

| Resource | ID / Name | Region |
|----------|-----------|--------|
| ECR — API | `forgenta-api` | ap-northeast-2 |
| ECR — Ollama | `forgenta-ollama` | ap-northeast-2 |
| ECS Cluster | `forgenta` | ap-northeast-2 |
| ECS Service | `forgenta-api` (desired: 1) | ap-northeast-2 |
| Task Definition | `forgenta:1` (4 vCPU / 16 GB) | ap-northeast-2 |
| EFS | `fs-01501d53a49e21753` | ap-northeast-2 |
| ALB | `forgenta-alb` | ap-northeast-2 |
| Target Group | `forgenta-api-tg` (health: `/api/health`) | ap-northeast-2 |
| IAM Role | `ecsTaskExecutionRole` | global |
| VPC | `vpc-050cc5e80d526129c` (default) | ap-northeast-2 |

### Public Endpoint

```
http://forgenta-alb-1276967058.ap-northeast-2.elb.amazonaws.com
```

### Deploy New Version

```bash
bash infra/deploy.sh          # uses :latest tag
bash infra/deploy.sh v1.2.0   # custom tag
```

### Monitor

```bash
# Service status
aws ecs describe-services --cluster forgenta --services forgenta-api \
  --region ap-northeast-2 \
  --query 'services[0].{status:status,running:runningCount,pending:pendingCount}'

# Logs
aws logs tail /ecs/forgenta --follow --region ap-northeast-2
```

---

## Known Limitations

| Item | Detail |
|------|--------|
| Inference speed | CPU-only on Fargate: ~5–15 s/token. Acceptable for internal tooling, not real-time chat. |
| ChromaDB | In-memory per task — data resets on task restart. Persist with EFS or migrate to a managed vector DB for production. |
| Catalog | In-memory only — no database persistence. |
| Frontend | `src/` not yet implemented (package.json scaffold only). |
| Auth | No authentication layer. Add Cognito or JWT before exposing publicly. |

---

## Roadmap

- [ ] Frontend: implement pages (Chat, Catalog, Builder, Dashboard)
- [ ] Persist ChromaDB to EFS or migrate to OpenSearch Serverless
- [ ] Add authentication (AWS Cognito / JWT)
- [ ] HTTPS: ACM certificate + ALB HTTPS listener
- [ ] CI/CD: GitHub Actions → ECR → ECS rolling deploy
- [ ] Catalog persistence: PostgreSQL (RDS)
- [ ] Upgrade model: switch to Claude via AWS Bedrock for production quality

---

## License

MIT
