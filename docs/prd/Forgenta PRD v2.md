# Forgenta PRD v2.0

## Hybrid Agentic AI Platform — 통합 설계 문서

Version: 2.0 | Status: CONFIRMED | Date: 2026-06-19 | Author: CAIO/CTO | Runtime: MacOS \+ k3d

# 1\. 제품 정의 (Product Definition)

1.1 한 줄 정의 (Confirmed Definition)  
Forgenta는 사용자의 입력(프롬프트 및 멀티모달 입력)을 해석해 반복 가능한 자동화 워크플로우와 멀티모달 결과를 만들어내고, 이를 에이전트/앱으로 카탈로그화·재사용·거버넌스할 수 있는 하이브리드 에이전틱 AI 플랫폼이다.

1.2 코어 파이프라인 (Core Pipeline)  
입력(Input) → 해석(Interpretation) → 워크플로우 실행(Execution) → 멀티모달 결과(Output) → 카탈로그화(Catalog) → 거버넌스(Governance)

1.3 핵심 원칙 (5 Design Principles)  
1\) STREAM-FIRST: 모든 LLM 응답은 스트리밍으로 표시. 타임아웃 전에 흐름이 보인다.  
2\) OUTPUT-CENTRIC: 멀티모달 Output Panel이 가장 넓은 공간. Text/Table/Chart/Image/CSV/SVG/3D 전환이 탭 한 번으로.  
3\) SEARCH-BEFORE-BUILD: 새로 만들기 전에 항상 Catalog 검색을 먼저 제안. Clone → Modify → Save 흐름이 기본값.  
4\) TRANSPARENCY: 어떤 LLM이 응답 중인지, 토큰은 얼마나 쓰는지, Headroom이 얼마나 절약했는지 항상 보인다.  
5\) PROGRESSIVE DISCLOSURE: 기본값은 단순하게. 필요할 때만 복잡한 설정 노출. 초보자\~파워유저 모두 같은 인터페이스.

# 2\. 시스템 아키텍처 (System Architecture v2)

2.1 런타임 전제 (MacOS \+ k3d)  
\- 하드웨어: MacBook Pro Apple Silicon (M2/M3/M4, 최소 32GB RAM, 100GB+ 스토리지)  
\- 컨테이너 런타임: OrbStack (Mac 최적화) 또는 Docker Desktop ARM64  
\- Kubernetes: k3d v5.x (Docker 기반 경량 k3s 클러스터)  
\- 로컈 LLM: Ollama (Metal 가속, k3d 외부 host 서비스) → host.k3d.internal:11434  
\- 패키지 관리: Helm v3, kubectl, k9s

2.2 네임스페이스 구조 (k3d Namespace Structure)  
forgenta-infra: PostgreSQL(+pgvector+TimescaleDB), Redis, Qdrant(VectorDB), MinIO(Artifact Storage)  
forgenta-core: API Gateway(Go), Orchestration-Svc(Python/LangGraph), Catalog-Svc(Go), Artifact-Svc(Go), Identity-Svc(Go), Headroom-Proxy(Go), Governance-Svc(Go)  
forgenta-obs: Loki(logs), Prometheus(metrics), Grafana(dashboard)  
forgenta-ui: Web Dashboard (React \+ Vite)

2.3 서비스 맵 (Service Map v2)  
\[1\] API Gateway (Go): 진입점. Rate Limiting, Auth Check, Request Routing, Response Aggregation. 전체 서비스로의 단일 창구.  
\[2\] Identity Service (Go/OIDC): SSO/OIDC/SAML, RBAC, 워크스페이스 컨텍스트 관리.  
\[3\] Orchestration Service (Python/LangGraph): LLM 호출 오케스트레이션 핵심. Planner/Executor/Critic/Summarizer/Router 노드 분리. RAG(PageIndex+Qdrant), MCP Gateway 내장.  
\[4\] Headroom Proxy (Go): 컨텍스트 압축 프록시. SmartCrusher(JSON/Go), CodeCompressor(AST/Rust), Kompress-base(text). 60\~95% 토큰 절감.  
\[5\] Catalog Service (Go): Agent/App/PromptTemplate 카탈로그. Clone/Use/Edit/Delete/Move, CloneLineage 관리.  
\[6\] Artifact Service (Go): 멀티모달 OutputArtifact 저장/조회. MinIO 연동. Text/Table/CSV/Image/SVG/2D/3D ChartSpec.  
\[7\] Governance & Metering Service (Go): Approval queue, AuditLog, UsageEvent 수집, 크레딧 정책 적용, MCP 계량.

# 3\. LLM 통합 전략 (Multi-LLM Strategy)

3.1 지원 Provider  
클라우드 LLM: Claude (Anthropic API), OpenAI/Codex (API Key), Gemini (API Key)  
로컬 LLM (Ollama): qwen3:8b, qwen3:14b (Metal 가속), gemma3:12b, qwen3:1.7b (경량/Router용)  
향후 확장 후보: GLM5.x, KimiK2.5, local\_vllm (DGX Spark 전환 시 교체 가능)

3.2 역할별 LLM 분리 (Multi-LLM Orchestration)  
Planner: Qwen3-14b (local) | fallback: Claude 3.7 (cloud)  
Executor: Qwen3-Coder or Gemma3-12b (local)  
Critic: Gemini 2.5 Pro (cloud, 편향 분리) | fallback: Claude 3.7  
Summarizer: Qwen3-8b (local, 경량)  
Router: Qwen3-1.7b (local, 최경량) or rule-based classifier

3.3 ModelRouter 정책 원칙  
\- 민감 데이터 포함 요청 → 로컬 ONLY (클라우드 금지)  
\- 잔여 budget \< 20% → Ollama 우선 \> 로컬 \> 클라우드 fallback  
\- 코드 생성 요청 → Qwen3-Coder 우선  
\- 한국어 멀티턴 → Qwen3 우선  
\- 고품질 필요 → Claude 3.7 / Gemini 2.5 Pro