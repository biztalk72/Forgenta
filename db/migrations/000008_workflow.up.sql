-- v3 Workflow Fabric 데이터 파운데이션: workflow / workflow_run / workflow_step_run (PRD v3, PLAN §5 Phase 11)
CREATE TABLE workflow (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    spec         JSONB NOT NULL DEFAULT '{}',          -- 컴파일된 워크플로우 정의(steps)
    source       TEXT NOT NULL DEFAULT 'manual'        -- nl | demo | manual
                 CHECK (source IN ('nl', 'demo', 'manual')),
    status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'active', 'archived')),
    version      INTEGER NOT NULL DEFAULT 1,
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_run (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id  UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'running'
                 CHECK (status IN ('pending', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled')),
    trigger      TEXT NOT NULL DEFAULT 'manual',
    context      JSONB NOT NULL DEFAULT '{}',          -- blackboard (단계 간 공유 컨텍스트)
    summary      TEXT,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

CREATE TABLE workflow_step_run (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id             UUID NOT NULL REFERENCES workflow_run(id) ON DELETE CASCADE,
    step_seq           INTEGER NOT NULL,
    kind               TEXT NOT NULL                   -- llm | tool | approval | export
                       CHECK (kind IN ('llm', 'tool', 'approval', 'export')),
    agent_id           UUID REFERENCES agent(id) ON DELETE SET NULL,
    status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'running', 'awaiting_approval', 'succeeded', 'failed', 'skipped')),
    input              JSONB NOT NULL DEFAULT '{}',
    output_artifact_id UUID REFERENCES artifact(id) ON DELETE SET NULL,
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    completion_tokens  INTEGER NOT NULL DEFAULT 0,
    latency_ms         INTEGER NOT NULL DEFAULT 0,
    error              TEXT,
    approval_id        UUID REFERENCES approval(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_seq)
);

-- 인덱스: 워크스페이스별 워크플로우 목록, 워크플로우/워크스페이스별 run, run별 step 조회
CREATE INDEX idx_workflow_workspace ON workflow (workspace_id);
CREATE INDEX idx_workflow_run_workflow ON workflow_run (workflow_id);
CREATE INDEX idx_workflow_run_workspace ON workflow_run (workspace_id);
CREATE INDEX idx_workflow_step_run_run ON workflow_step_run (run_id);
