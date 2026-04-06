// ─── User & Auth ─────────────────────────────────────────
export type UserRole = 'user' | 'power_user' | 'admin';
export type UserStatus = 'active' | 'invited' | 'disabled';

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  workspace_id: string;
  workspace_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  provider?: 'google' | 'microsoft' | 'sso' | 'email';
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// ─── Workspace ───────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  type: 'team' | 'department' | 'project' | 'org';
  status: 'active' | 'archived';
}

// ─── Catalog ─────────────────────────────────────────────
export type CatalogItemType = 'agent' | 'app';
export type CatalogItemStatus = 'draft' | 'published' | 'archived';
export type Visibility = 'private' | 'workspace' | 'org';

export interface CatalogItem {
  id: string;
  workspace_id: string;
  type: CatalogItemType;
  name: string;
  description: string;
  owner_user_id: string;
  owner_name: string;
  visibility: Visibility;
  status: CatalogItemStatus;
  cloned_from_item_id?: string;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Prompt ──────────────────────────────────────────────
export interface PromptTemplate {
  id: string;
  catalog_item_id: string;
  version_no: number;
  template_text: string;
  created_by: string;
  created_at: string;
}

export interface PromptRefineResult {
  original: string;
  refined: string;
  intent: string;
  suggestions: string[];
}

// ─── Chat ────────────────────────────────────────────────
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: OutputArtifact[];
  created_at: string;
}

// ─── Output Artifacts ────────────────────────────────────
export type ArtifactType = 'text' | 'table' | 'csv' | 'image' | 'svg' | 'chart2d' | 'chart3d';

export interface OutputArtifact {
  id: string;
  artifact_type: ArtifactType;
  storage_uri: string;
  mime_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  data: Record<string, unknown>[];
  x_key: string;
  y_key: string;
  series?: string[];
}

// ─── Approval ────────────────────────────────────────────
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface ApprovalItem {
  id: string;
  workspace_id: string;
  target_type: 'agent' | 'app' | 'prompt';
  target_id: string;
  target_name: string;
  submitted_by: string;
  submitted_by_name: string;
  assigned_to?: string;
  status: ApprovalStatus;
  comment?: string;
  created_at: string;
  updated_at: string;
}

// ─── Audit ───────────────────────────────────────────────
export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_name: string;
  workspace_id: string;
  target_type: string;
  target_id: string;
  action: string;
  result: 'success' | 'failure';
  created_at: string;
}

// ─── Pagination ──────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
