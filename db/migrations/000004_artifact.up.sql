-- 멀티모달 OutputArtifact (Artifact-Svc 도메인, MinIO 오브젝트 키 참조)
CREATE TABLE artifact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_id    UUID REFERENCES agent(id) ON DELETE SET NULL,
    type        TEXT NOT NULL
                CHECK (type IN ('text','table','csv','image','svg','chart2d','chart3d')),
    mime_type   TEXT,
    storage_key TEXT NOT NULL,                -- MinIO object key
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artifact_workspace ON artifact(workspace_id);
CREATE INDEX idx_artifact_agent ON artifact(agent_id);
