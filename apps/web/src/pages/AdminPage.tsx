import { useState } from 'react';
import { Clock, AlertTriangle, Users, HardDrive, Check, X } from 'lucide-react';
import { mockApprovals, mockAuditLogs } from '@/lib/mockData';
import { clsx } from 'clsx';

type AdminTab = 'approvals' | 'audit' | 'roles' | 'datasets';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('approvals');

  const kpis = [
    { label: 'Pending Approvals', value: mockApprovals.filter((a) => a.status === 'pending').length, icon: Clock, color: 'text-warning' },
    { label: 'Failed Jobs', value: 0, icon: AlertTriangle, color: 'text-danger' },
    { label: 'Active Users', value: 24, icon: Users, color: 'text-brand' },
    { label: 'Storage Used', value: '2.4 GB', icon: HardDrive, color: 'text-success' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Admin Console</h1>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-4">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center bg-surface-secondary', kpi.color)}>
              <kpi.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              <p className="text-xs text-text-muted">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'approvals', label: 'Approvals' },
          { key: 'audit', label: 'Audit Logs' },
          { key: 'roles', label: 'Roles & Users' },
          { key: 'datasets', label: 'Datasets' },
        ] as { key: AdminTab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
              activeTab === tab.key
                ? 'text-brand border-brand'
                : 'text-text-muted border-transparent hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'approvals' && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Item</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Type</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Submitted By</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockApprovals.map((item) => (
                <tr key={item.id} className="border-b border-border-light hover:bg-surface-secondary">
                  <td className="py-3 px-4 font-medium text-text-primary">{item.target_name}</td>
                  <td className="py-3 px-4 capitalize text-text-secondary">{item.target_type}</td>
                  <td className="py-3 px-4 text-text-secondary">{item.submitted_by_name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-xs bg-warning/10 text-warning rounded-full">{item.status}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button className="p-1.5 text-success bg-success/10 rounded-lg hover:bg-success/20 transition-colors">
                        <Check size={14} />
                      </button>
                      <button className="p-1.5 text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Time</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Actor</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Action</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Target</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted">Result</th>
              </tr>
            </thead>
            <tbody>
              {mockAuditLogs.map((log) => (
                <tr key={log.id} className="border-b border-border-light hover:bg-surface-secondary">
                  <td className="py-3 px-4 text-text-muted text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-text-primary">{log.actor_name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-xs bg-surface-tertiary text-text-secondary rounded-full">{log.action}</span>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">{log.target_type}/{log.target_id}</td>
                  <td className="py-3 px-4">
                    <span className={clsx('px-2 py-0.5 text-xs rounded-full', log.result === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                      {log.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="bg-white border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Users & Roles</h3>
          <div className="space-y-2">
            {[
              { name: '김엔지니어', email: 'kim@forgenta.io', role: 'power_user' },
              { name: '박정비', email: 'park@forgenta.io', role: 'power_user' },
              { name: '이재무', email: 'lee@forgenta.io', role: 'user' },
              { name: '최인사', email: 'choi@forgenta.io', role: 'user' },
              { name: 'Admin', email: 'admin@forgenta.io', role: 'admin' },
            ].map((u) => (
              <div key={u.email} className="flex items-center justify-between py-3 px-4 border border-border-light rounded-lg">
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-muted">{u.email}</p>
                </div>
                <span className="px-2 py-0.5 text-xs bg-brand/10 text-brand rounded-full capitalize">{u.role.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'datasets' && (
        <div className="bg-white border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Dataset Registry</h3>
          <div className="space-y-2">
            {[
              { name: '제조 공개 데이터', type: 'manufacturing_open', status: 'active' },
              { name: 'Synthetic HR', type: 'synthetic_hr', status: 'active' },
              { name: 'Synthetic Finance', type: 'synthetic_finance', status: 'active' },
            ].map((ds) => (
              <div key={ds.name} className="flex items-center justify-between py-3 px-4 border border-border-light rounded-lg">
                <div>
                  <p className="text-sm font-medium text-text-primary">{ds.name}</p>
                  <p className="text-xs text-text-muted">{ds.type}</p>
                </div>
                <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">{ds.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
