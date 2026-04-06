# Forgenta v1.2 MVP Implementation Plan
## Problem
Forgenta is a Hybrid Agentic AI App Platform with PRD, IA, architecture, ERD, and backlog docs completed, but the codebase is an empty scaffold (default Vite+React template, empty Python package, PostgreSQL docker-compose only).
## Current State
* `apps/web`: Vite + React 19 default boilerplate, no routing/layout/pages
* `apps/api`: Empty `__init__.py` with hello print, Python 3.14, uv build
* `infra/docker`: PostgreSQL 16 only
* No Tailwind, no router, no state management, no API framework installed
## MVP Scope (P0 from PRD)
Focusing on P0 features per PRD priority:
1. Splash/Login screen
2. Main Dashboard 3-panel layout (Sidebar, Workspace, Output Panel)
3. Chat Composer with session management
4. Prompt refinement & comparison UI
5. Agent/App Catalog with card/list views, detail rollup
6. Multimodal Output Panel (text, table, CSV download, image, 2D chart)
7. Builder/Editor Lite
8. Admin Console Lite
## Tech Stack
### Frontend (`apps/web`)
* React 19 + TypeScript + Vite (existing)
* TailwindCSS 4 for styling
* React Router v7 for routing
* Zustand for lightweight state management
* Recharts for 2D charts
* Lucide React for icons
### Backend (`apps/api`)
* FastAPI + Uvicorn
* SQLAlchemy 2.0 + asyncpg (async PostgreSQL)
* Alembic for migrations
* Pydantic v2 for schemas
* python-jose + passlib for auth
### Infrastructure
* PostgreSQL 16 (existing docker-compose)
* Add Redis for session/cache (optional, defer)
## Implementation Steps
### Phase 1: Project Foundation
1. **Frontend setup**: Install Tailwind 4, React Router, Zustand, Recharts, Lucide. Configure path aliases, base layout.
2. **Backend setup**: Install FastAPI, SQLAlchemy, asyncpg, Alembic, Pydantic. Create app factory, config, DB connection.
3. **Database**: Apply ERD schema via Alembic initial migration.
4. **Docker**: Update docker-compose to include API service, web dev proxy.
### Phase 2: Auth & Layout (Sprint 1)
5. **Splash/Login page**: Logo, product description, Google/MS/SSO/Email login buttons (mock auth for MVP).
6. **Main Layout**: Sidebar (collapsible), TopBar (search, workspace, profile), 3-panel dashboard structure.
7. **Auth API**: `POST /auth/login`, `GET /me` endpoints with JWT mock.
8. **Role-based menu visibility**: Sidebar items filtered by role.
### Phase 3: Chat & Prompt (Sprint 2)
9. **Chat Composer**: Input, send, loading state, session history sidebar.
10. **Prompt Compare Panel**: Side-by-side original vs refined prompt.
11. **Recommendation Rail**: Similar templates/agents cards.
12. **Chat API**: `POST /chat/sessions`, `POST /chat/sessions/{id}/messages`.
13. **Prompt API**: `POST /prompts/refine`, `POST /prompts/compare`.
### Phase 4: Catalog (Sprint 3)
14. **Agent Catalog page**: Search, filter, card/list toggle, sort.
15. **App Catalog page**: Same structure + preview thumbnail.
16. **Catalog Detail Rollup**: Side panel with Use/Edit/Clone/Delete/Move actions.
17. **Catalog API**: CRUD endpoints for catalog items.
### Phase 5: Output & Builder (Sprint 4-5)
18. **Output Panel**: Tabbed viewer (Text, Table, CSV, Image, Chart).
19. **CSV download, image viewer, 2D chart** (Recharts).
20. **Builder/Editor Lite**: Prompt/DataSource/Output/Guardrails tabs.
21. **Artifact API**: `GET /artifacts/{id}`, download endpoints.
### Phase 6: Admin & Governance (Sprint 6)
22. **Admin Console Lite**: KPI bar, approval queue, audit log table.
23. **Admin API**: Approvals, audit logs endpoints.
24. **Seed data**: Sample catalog items, prompts, datasets for demo.
## Key Decisions
* **Mock auth for MVP**: JWT-based mock login, no real OAuth providers yet. Login form stores role in token.
* **Mock AI responses**: Prompt refinement and chat will return structured mock data to demonstrate the full UI flow.
* **UUID for IDs**: Use UUID v4 instead of text IDs for production readiness.
* **Soft delete**: Add `deleted_at` nullable timestamp to key tables.
