-- 거버넌스/계량: 승인 큐, 감사 로그, 사용량 이벤트(TimescaleDB 하이퍼테이블)
CREATE TABLE approval (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    requested_by  UUID REFERENCES users(id),
    resource_type TEXT NOT NULL,
    resource_id   UUID,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
    decided_by    UUID REFERENCES users(id),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspace(id) ON DELETE CASCADE,
    actor_id     UUID REFERENCES users(id),
    action       TEXT NOT NULL,
    target_type  TEXT,
    target_id    UUID,
    detail       JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 사용량 이벤트: 계량/과금 시계열. FK 생략(인제스트 성능), 하이퍼테이블로 변환.
CREATE TABLE usage_event (
    time              TIMESTAMPTZ NOT NULL DEFAULT now(),
    id                UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL,
    user_id           UUID,
    agent_id          UUID,
    provider          TEXT,
    model             TEXT,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    original_tokens   INTEGER,
    compressed_tokens INTEGER,
    latency_ms        INTEGER,
    success           BOOLEAN,
    PRIMARY KEY (time, id)
);

SELECT create_hypertable('usage_event', 'time', if_not_exists => TRUE);

CREATE INDEX idx_approval_workspace_status ON approval(workspace_id, status);
CREATE INDEX idx_audit_log_workspace ON audit_log(workspace_id, created_at DESC);
CREATE INDEX idx_usage_event_workspace_time ON usage_event(workspace_id, time DESC);
