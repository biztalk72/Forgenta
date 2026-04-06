# Forgenta v1.2 ERD 상세 스키마 문서

## 문서 목적

본 문서는 Forgenta v1.2의 PostgreSQL 기준 상세 스키마 초안이다. 관계형 데이터베이스에서 외래키와 제약조건은 데이터 무결성의 핵심이며, 특히 PostgreSQL에서는 FK 컬럼 인덱스, CHECK 제약, 명확한 상태값 관리가 성능과 안정성에 큰 영향을 준다.[cite:191][cite:194][cite:197] 따라서 본 문서는 주요 테이블, 인덱스, 관계 제약, 설계 규칙을 함께 정의한다.[cite:197]

## 설계 원칙

- 기본 키는 `text` 기반 식별자(`usr_001` 등) 또는 UUID를 사용한다.
- 상태값은 자유 텍스트보다 CHECK 제약 또는 enum 성격의 제약으로 관리한다.[cite:197]
- 모든 외래키 컬럼에는 명시적 인덱스를 둔다. PostgreSQL은 FK 인덱스를 자동 생성하지 않으므로 직접 생성해야 JOIN과 CASCADE 성능이 유지된다.[cite:191]
- 감사 가능성을 위해 주요 테이블에 `created_at`, `updated_at`를 둔다.
- 삭제 정책은 도메인별로 다르게 적용한다. 예를 들어 AuditLog는 보존하고, 세부 설정은 cascade 또는 restrict를 선택한다.[cite:194]

## 핵심 ERD 개요

```text
users 1---N role_bindings N---1 workspaces
workspaces 1---N catalog_items
catalog_items 1---0..1 agent_configs
catalog_items 1---0..1 app_configs
catalog_items 1---N dataset_bindings N---1 dataset_registry
catalog_items 1---N prompt_templates
prompt_templates 1---N prompt_executions
prompt_executions 1---N output_artifacts
catalog_items 1---N approval_items
users 1---N audit_logs
catalog_items 1---N audit_logs
workspaces 1---N audit_logs
```

## PostgreSQL DDL 초안

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('team', 'department', 'project', 'org')),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_bindings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'power_user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id)
);
CREATE INDEX idx_role_bindings_user_id ON role_bindings(user_id);
CREATE INDEX idx_role_bindings_workspace_id ON role_bindings(workspace_id);

CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('agent', 'app')),
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'workspace', 'org')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  cloned_from_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_items_workspace_id ON catalog_items(workspace_id);
CREATE INDEX idx_catalog_items_owner_user_id ON catalog_items(owner_user_id);
CREATE INDEX idx_catalog_items_cloned_from_item_id ON catalog_items(cloned_from_item_id);
CREATE INDEX idx_catalog_items_type_status ON catalog_items(type, status);

CREATE TABLE agent_configs (
  catalog_item_id TEXT PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
  model_strategy JSONB NOT NULL,
  prompt_config JSONB NOT NULL,
  guardrails_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_configs (
  catalog_item_id TEXT PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
  layout_config JSONB NOT NULL,
  widget_config JSONB NOT NULL,
  output_preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dataset_registry (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dataset_type TEXT NOT NULL CHECK (dataset_type IN ('manufacturing_open', 'synthetic_hr', 'synthetic_finance', 'document', 'table')),
  storage_uri TEXT NOT NULL,
  vector_index_name TEXT,
  schema_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dataset_registry_workspace_id ON dataset_registry(workspace_id);
CREATE INDEX idx_dataset_registry_type ON dataset_registry(dataset_type);

CREATE TABLE dataset_bindings (
  id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  dataset_id TEXT NOT NULL REFERENCES dataset_registry(id) ON DELETE CASCADE,
  binding_type TEXT NOT NULL CHECK (binding_type IN ('default', 'optional', 'recommended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_item_id, dataset_id)
);
CREATE INDEX idx_dataset_bindings_catalog_item_id ON dataset_bindings(catalog_item_id);
CREATE INDEX idx_dataset_bindings_dataset_id ON dataset_bindings(dataset_id);

CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  template_text TEXT NOT NULL,
  output_schema JSONB,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_item_id, version_no)
);
CREATE INDEX idx_prompt_templates_catalog_item_id ON prompt_templates(catalog_item_id);
CREATE INDEX idx_prompt_templates_created_by ON prompt_templates(created_by);

CREATE TABLE prompt_executions (
  id TEXT PRIMARY KEY,
  prompt_template_id TEXT REFERENCES prompt_templates(id) ON DELETE SET NULL,
  catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL,
  input_text TEXT NOT NULL,
  refined_prompt TEXT,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  model_route TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prompt_executions_prompt_template_id ON prompt_executions(prompt_template_id);
CREATE INDEX idx_prompt_executions_catalog_item_id ON prompt_executions(catalog_item_id);
CREATE INDEX idx_prompt_executions_user_id ON prompt_executions(user_id);
CREATE INDEX idx_prompt_executions_session_id ON prompt_executions(session_id);
CREATE INDEX idx_prompt_executions_status ON prompt_executions(execution_status);

CREATE TABLE output_artifacts (
  id TEXT PRIMARY KEY,
  prompt_execution_id TEXT NOT NULL REFERENCES prompt_executions(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('text', 'table', 'csv', 'image', 'svg', 'chart2d', 'chart3d')),
  storage_uri TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_output_artifacts_prompt_execution_id ON output_artifacts(prompt_execution_id);
CREATE INDEX idx_output_artifacts_type ON output_artifacts(artifact_type);

CREATE TABLE approval_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'app', 'prompt')),
  target_id TEXT NOT NULL,
  submitted_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_items_workspace_id ON approval_items(workspace_id);
CREATE INDEX idx_approval_items_submitted_by ON approval_items(submitted_by);
CREATE INDEX idx_approval_items_assigned_to ON approval_items(assigned_to);
CREATE INDEX idx_approval_items_status ON approval_items(status);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'failure')),
  trace_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

## 관계 및 제약 메모

- `role_bindings`는 사용자와 워크스페이스의 다대다 관계를 풀어내는 테이블이다.
- `catalog_items`는 agent/app 공통 메타데이터를 담고, 세부 설정은 `agent_configs`, `app_configs`로 1:1 분리한다.
- `dataset_bindings`는 자산과 데이터셋의 다대다 관계를 표현한다.
- `prompt_executions`는 실제 실행 이력이고, `output_artifacts`는 멀티모달 산출물을 연결한다.
- `audit_logs`는 삭제하지 않고 가능한 한 보존하는 방향이 적절하다.

## 인덱스 전략 메모

PostgreSQL에서는 외래키 컬럼에 인덱스를 명시적으로 생성해야 JOIN과 CASCADE가 성능 저하 없이 동작한다.[cite:191] 또한 검색이 잦은 상태값, 워크스페이스, 소유자, 세션 기준 컬럼은 조합 인덱스를 검토하는 것이 좋다.[cite:197]

## 다음 단계

이 문서는 PostgreSQL 기준의 첫 상세 초안이므로, 실제 구현 전에는 다음을 추가로 확정해야 한다.

- UUID vs 텍스트 ID 최종 결정.
- JSONB 필드의 상세 schema 문서화.
- full-text search 또는 vector metadata 보조 테이블 여부.
- soft delete 컬럼 채택 여부.

관계형 무결성과 성능을 초기에 잡아두는 것이 후반 리팩터링 비용을 크게 줄인다.[cite:191][cite:194][cite:197]
