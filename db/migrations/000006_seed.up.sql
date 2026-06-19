-- 시드 데이터: 기본 역할 4종 + 기본 워크스페이스 + 관리자 + 소유자 멤버십
INSERT INTO role (name, description) VALUES
    ('owner',  '워크스페이스 소유자'),
    ('admin',  '관리자'),
    ('member', '멤버'),
    ('viewer', '읽기 전용')
ON CONFLICT (name) DO NOTHING;

INSERT INTO workspace (name, slug) VALUES ('Default Workspace', 'default')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (email, display_name) VALUES ('admin@forgenta.local', 'Admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO workspace_member (workspace_id, user_id, role_id)
SELECT w.id, u.id, r.id
FROM workspace w, users u, role r
WHERE w.slug = 'default' AND u.email = 'admin@forgenta.local' AND r.name = 'owner'
ON CONFLICT (workspace_id, user_id) DO NOTHING;
