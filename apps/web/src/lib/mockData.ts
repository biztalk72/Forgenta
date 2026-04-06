import type {
  CatalogItem, ChatSession, ChatMessage, ApprovalItem, AuditLog, ChartSpec,
} from '@/types';

export const mockCatalogItems: CatalogItem[] = [
  {
    id: 'cat-001', workspace_id: 'ws-001', type: 'agent', name: '품질 이상치 분석 에이전트',
    description: '제조 공정 데이터에서 품질 이상치를 탐지하고 근본 원인을 분석합니다.',
    owner_user_id: 'usr-001', owner_name: '김엔지니어', visibility: 'workspace',
    status: 'published', tags: ['제조', '품질', '이상탐지'], usage_count: 47,
    created_at: '2026-03-15T09:00:00Z', updated_at: '2026-03-28T14:30:00Z',
  },
  {
    id: 'cat-002', workspace_id: 'ws-001', type: 'agent', name: '정비 보고서 생성 에이전트',
    description: '설비 정비 이력을 기반으로 구조화된 보고서를 자동 생성합니다.',
    owner_user_id: 'usr-002', owner_name: '박정비', visibility: 'org',
    status: 'published', tags: ['제조', '정비', '보고서'], usage_count: 32,
    created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-25T11:00:00Z',
  },
  {
    id: 'cat-003', workspace_id: 'ws-001', type: 'app', name: '비용 이상치 분석 앱',
    description: 'Finance 데이터의 비용 이상치를 시각화하고 트렌드를 분석합니다.',
    owner_user_id: 'usr-003', owner_name: '이재무', visibility: 'workspace',
    status: 'published', tags: ['재무', '비용분석', '시각화'], usage_count: 28,
    created_at: '2026-03-05T08:00:00Z', updated_at: '2026-03-20T16:00:00Z',
  },
  {
    id: 'cat-004', workspace_id: 'ws-001', type: 'app', name: 'HR 인력현황 대시보드',
    description: '부서별 인력 현황, 이직률, 채용 파이프라인을 한눈에 보여줍니다.',
    owner_user_id: 'usr-004', owner_name: '최인사', visibility: 'org',
    status: 'published', tags: ['HR', '인력', '대시보드'], usage_count: 61,
    created_at: '2026-02-20T09:00:00Z', updated_at: '2026-03-18T10:00:00Z',
  },
  {
    id: 'cat-005', workspace_id: 'ws-001', type: 'agent', name: '공정 파라미터 최적화 에이전트',
    description: '제조 공정의 주요 파라미터를 분석하고 최적 조건을 추천합니다.',
    owner_user_id: 'usr-001', owner_name: '김엔지니어', visibility: 'workspace',
    status: 'draft', tags: ['제조', '최적화', '파라미터'], usage_count: 5,
    created_at: '2026-03-25T11:00:00Z', updated_at: '2026-03-30T15:00:00Z',
  },
  {
    id: 'cat-006', workspace_id: 'ws-001', type: 'app', name: '공급망 리스크 모니터링',
    description: '공급업체별 납기 지연, 품질 이슈를 실시간 추적합니다.',
    owner_user_id: 'usr-002', owner_name: '박정비', visibility: 'workspace',
    status: 'published', tags: ['제조', '공급망', '리스크'], usage_count: 19,
    created_at: '2026-03-01T10:00:00Z', updated_at: '2026-03-22T09:00:00Z',
  },
];

export const mockSessions: ChatSession[] = [
  { id: 'ses-001', title: '3월 품질 이상 분석', created_at: '2026-04-01T10:00:00Z', message_count: 5 },
  { id: 'ses-002', title: '정비 보고서 생성 테스트', created_at: '2026-03-31T14:00:00Z', message_count: 3 },
  { id: 'ses-003', title: 'HR 이직률 분석', created_at: '2026-03-30T09:00:00Z', message_count: 8 },
];

export const mockMessages: ChatMessage[] = [
  {
    id: 'msg-001', role: 'user', content: '3월 생산라인 A의 불량률 추이를 분석해주세요.',
    created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'msg-002', role: 'assistant',
    content: '3월 생산라인 A의 불량률 분석 결과입니다.\n\n전체 불량률은 2.3%로 전월 대비 0.4%p 상승했습니다. 주요 원인은 3월 둘째 주 원자재 로트 변경에 따른 치수 불량 증가로 파악됩니다.\n\n- **평균 불량률**: 2.3%\n- **최대 불량일**: 3/12 (4.1%)\n- **주요 불량 유형**: 치수 불량 (58%), 외관 불량 (27%), 기능 불량 (15%)',
    artifacts: [
      {
        id: 'art-001', artifact_type: 'chart2d', storage_uri: '', mime_type: 'application/json',
        metadata: {}, created_at: '2026-04-01T10:00:30Z',
      },
      {
        id: 'art-002', artifact_type: 'table', storage_uri: '', mime_type: 'application/json',
        metadata: {}, created_at: '2026-04-01T10:00:30Z',
      },
    ],
    created_at: '2026-04-01T10:00:30Z',
  },
];

export const mockChartData: ChartSpec = {
  type: 'line',
  title: '3월 생산라인 A 일별 불량률',
  x_key: 'date',
  y_key: 'rate',
  data: [
    { date: '3/1', rate: 1.8 }, { date: '3/4', rate: 2.1 }, { date: '3/5', rate: 1.9 },
    { date: '3/6', rate: 2.0 }, { date: '3/7', rate: 2.4 }, { date: '3/10', rate: 2.8 },
    { date: '3/11', rate: 3.5 }, { date: '3/12', rate: 4.1 }, { date: '3/13', rate: 3.2 },
    { date: '3/14', rate: 2.6 }, { date: '3/17', rate: 2.2 }, { date: '3/18', rate: 2.0 },
    { date: '3/19', rate: 1.9 }, { date: '3/20', rate: 1.7 }, { date: '3/21', rate: 1.8 },
    { date: '3/24', rate: 1.6 }, { date: '3/25', rate: 1.5 }, { date: '3/26', rate: 1.7 },
    { date: '3/27', rate: 1.8 }, { date: '3/28', rate: 1.6 }, { date: '3/31', rate: 1.5 },
  ],
};

export const mockTableData = {
  columns: ['날짜', '생산량', '불량수', '불량률(%)', '주요 유형'],
  rows: [
    ['3/10', '1,200', '34', '2.8', '치수 불량'],
    ['3/11', '1,180', '41', '3.5', '치수 불량'],
    ['3/12', '1,150', '47', '4.1', '치수 불량'],
    ['3/13', '1,200', '38', '3.2', '외관 불량'],
    ['3/14', '1,210', '31', '2.6', '치수 불량'],
  ],
};

export const mockApprovals: ApprovalItem[] = [
  {
    id: 'apv-001', workspace_id: 'ws-001', target_type: 'agent', target_id: 'cat-005',
    target_name: '공정 파라미터 최적화 에이전트', submitted_by: 'usr-001',
    submitted_by_name: '김엔지니어', status: 'pending',
    created_at: '2026-03-30T15:00:00Z', updated_at: '2026-03-30T15:00:00Z',
  },
  {
    id: 'apv-002', workspace_id: 'ws-001', target_type: 'app', target_id: 'cat-006',
    target_name: '공급망 리스크 모니터링', submitted_by: 'usr-002',
    submitted_by_name: '박정비', status: 'pending',
    created_at: '2026-03-29T11:00:00Z', updated_at: '2026-03-29T11:00:00Z',
  },
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'log-001', actor_user_id: 'usr-001', actor_name: '김엔지니어', workspace_id: 'ws-001', target_type: 'agent', target_id: 'cat-001', action: 'execute', result: 'success', created_at: '2026-04-01T10:05:00Z' },
  { id: 'log-002', actor_user_id: 'usr-003', actor_name: '이재무', workspace_id: 'ws-001', target_type: 'app', target_id: 'cat-003', action: 'clone', result: 'success', created_at: '2026-04-01T09:30:00Z' },
  { id: 'log-003', actor_user_id: 'usr-004', actor_name: '최인사', workspace_id: 'ws-001', target_type: 'app', target_id: 'cat-004', action: 'execute', result: 'success', created_at: '2026-04-01T09:00:00Z' },
  { id: 'log-004', actor_user_id: 'usr-002', actor_name: '박정비', workspace_id: 'ws-001', target_type: 'agent', target_id: 'cat-002', action: 'publish', result: 'success', created_at: '2026-03-31T16:00:00Z' },
  { id: 'log-005', actor_user_id: 'usr-001', actor_name: '김엔지니어', workspace_id: 'ws-001', target_type: 'prompt', target_id: 'pt-001', action: 'refine', result: 'success', created_at: '2026-03-31T15:00:00Z' },
];
