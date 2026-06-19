-- 카탈로그: Agent/App/PromptTemplate + Clone 계보 (Catalog-Svc 도메인)
CREATE TABLE agent (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    config      JSONB NOT NULL DEFAULT '{}',
    visibility  TEXT NOT NULL DEFAULT 'workspace'
                CHECK (visibility IN ('private','workspace','public')),
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    manifest    JSONB NOT NULL DEFAULT '{}',
    visibility  TEXT NOT NULL DEFAULT 'workspace'
                CHECK (visibility IN ('private','workspace','public')),
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_template (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    body        TEXT NOT NULL,
    variables   JSONB NOT NULL DEFAULT '[]',
    visibility  TEXT NOT NULL DEFAULT 'workspace'
                CHECK (visibility IN ('private','workspace','public')),
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clone_lineage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('agent','app','prompt_template')),
    source_id   UUID NOT NULL,
    target_id   UUID NOT NULL,
    cloned_by   UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_workspace ON agent(workspace_id);
CREATE INDEX idx_app_workspace ON app(workspace_id);
CREATE INDEX idx_prompt_template_workspace ON prompt_template(workspace_id);
CREATE INDEX idx_clone_lineage_source ON clone_lineage(entity_type, source_id);
