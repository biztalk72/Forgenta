# Forgenta — Hybrid Agentic AI App Platform

> Enterprise AI platform with RAG-powered chat, agent catalog, and prompt management.  
> Full-stack React + FastAPI, containerised with Docker Compose, deployed on AWS ECS Fargate.

[한국어 문서 →](./README.ko.md)

---

## Overview

Forgenta is a hybrid agentic AI platform designed for enterprise internal data — manufacturing, HR, and finance. It provides a streaming RAG chat interface, an agent/app catalog, and a prompt refinement engine, all powered by a local LLM via Ollama.

```
Browser → React Frontend (nginx :3000)
               ↓ /api/*
          FastAPI Backend (:8000)  ←→  ChromaDB (vector search)
               ↓
          Ollama (:11434)
          ├── qwen3:0.6b        (chat + prompt refinement)
          └── nomic-embed-text  (embeddings)
               ↓
          Seed Data (manufacturing / HR / finance JSON)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, Recharts, lucide-react |
| Backend | FastAPI 0.115, Python 3.12, Uvicorn |
| LLM | Ollama (`qwen3:0.6b` — CPU-friendly) |
| Embeddings | Ollama (`nomic-embed-text`) |
| Vector DB | ChromaDB 0.6 (in-memory, EFS-backed on AWS) |
| Container | Docker, Docker Compose, nginx:alpine |
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
│   │   ├── prompt.py         # POST /api/prompt/refine|refine/stream|similar|save
│   │   └── catalog.py        # GET/POST /api/catalog/agents|apps
│   ├── services/
│   │   ├── llm.py            # Ollama chat + streaming prompt refinement
│   │   ├── vector.py         # ChromaDB embed + search
│   │   └── data_seed.py      # JSON seed loader
│   └── data/
│       ├── manufacturing.json
│       ├── hr.json
│       └── finance.json
├── frontend/
│   ├── Dockerfile            # Multi-stage: node:22 build → nginx:alpine serve
│   ├── nginx.conf            # SPA fallback + /api/ proxy (buffering off for SSE)
│   ├── vite.config.js        # Tailwind v4 plugin + dev proxy to :8000
│   ├── index.html
│   └── src/
│       ├── App.jsx           # React Router routes
│       ├── components/
│       │   ├── Layout.jsx    # Dark sidebar navigation
│       │   ├── ChartBlock.jsx # Recharts bar/line/pie renderer
│       │   └── TableBlock.jsx # Data table renderer
│       ├── lib/
│       │   ├── api.js        # Fetch helpers + async generators for SSE streams
│       │   └── parseResponse.js  # Extract json:chart / json:table blocks
│       └── pages/
│           ├── Dashboard.jsx # Health, stats, infra panel, top catalog items
│           ├── Chat.jsx      # Streaming RAG chat with chart/table rendering
│           ├── Catalog.jsx   # Agent/app browser with search, filter, clone modal
│           └── Builder.jsx   # Prompt refinement (streaming), similar search, save
├── ollama/
│   ├── Dockerfile            # Ollama image with lazy model pull
│   └── entrypoint.sh         # Pull qwen3:0.6b + nomic-embed-text on first start
├── infra/
│   ├── deploy.sh             # Build → ECR push → ECS deploy
│   └── ecs/
│       └── task-definition.json  # Fargate 4vCPU/16GB, EFS volume
├── Dockerfile                # FastAPI container (python:3.12-slim)
└── docker-compose.yml        # Full stack: ollama + api + frontend
```

---

## Local Development

### Prerequisites
- Docker Desktop

### Run with Docker Compose (recommended)

```bash
git clone https://github.com/biztalk72/Forgenta.git
cd Forgenta
docker compose up --build
```

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | React SPA served by nginx |
| API | http://localhost:8000 | FastAPI + Swagger at `/docs` |
| Ollama | http://localhost:11434 | LLM inference |

> **First start:** pulls `qwen3:0.6b` (~500 MB) and `nomic-embed-text` (~270 MB).  
> The API waits for both models to be ready before starting (healthcheck guards this).  
> Subsequent starts use the cached `ollama_data` volume — much faster.

### Run frontend in dev mode (hot reload)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api → http://localhost:8000
```

### Run backend without Docker

```bash
pip install -r backend/requirements.txt
# Requires Ollama running locally: https://ollama.com
uvicorn backend.main:app --reload
```

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Live health badge, stat cards, infra panel, top catalog items by usage |
| Chat | `/chat` | Streaming RAG chat — responses auto-render charts and tables |
| Catalog | `/catalog` | Search + filter agents/apps by type or domain; clone agents |
| Builder | `/builder` | Stream-refine a prompt with LLM, find similar from vault, save |

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
POST /api/prompt/refine          Body: { "text": "..." }  → { original, refined }
POST /api/prompt/refine/stream   Body: { "text": "..." }  → text/plain stream
POST /api/prompt/similar         Body: { "text": "..." }  → { similar: [...] }
POST /api/prompt/save            Body: { "text": "...", "metadata": {} }
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

## Docker Compose Services

```yaml
services:
  ollama:    # Ollama LLM server — pulls models on first start
  api:       # FastAPI backend — waits for ollama healthy
  frontend:  # nginx serving React build — proxies /api/ to api:8000
```

The `ollama` healthcheck polls for `nomic-embed-text` in the model list, so the `api`
container only starts after both models are fully downloaded.

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
| Inference speed | CPU-only on Fargate: ~5–15 s/token. Acceptable for internal tooling. |
| ChromaDB | In-memory per task — data resets on task restart. Persist with EFS or migrate to a managed vector DB for production. |
| Catalog | In-memory only — no database persistence. |
| Auth | No authentication layer. Add Cognito or JWT before exposing publicly. |

---

## Roadmap

- [x] Frontend: Dashboard, Chat, Catalog, Builder pages
- [x] Streaming prompt refinement (`/api/prompt/refine/stream`)
- [x] Docker Compose full-stack (ollama + api + frontend)
- [ ] Persist ChromaDB to EFS or migrate to OpenSearch Serverless
- [ ] Add authentication (AWS Cognito / JWT)
- [ ] HTTPS: ACM certificate + ALB HTTPS listener
- [ ] CI/CD: GitHub Actions → ECR → ECS rolling deploy
- [ ] Catalog persistence: PostgreSQL (RDS)
- [ ] Upgrade model: switch to Claude via AWS Bedrock for production quality

---

## License

MIT
