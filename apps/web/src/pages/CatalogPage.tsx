import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, LayoutGrid, List, X, Bot, AppWindow, Play, Copy, Pencil, Trash2, ArrowRight, User, Eye } from 'lucide-react';
import { mockCatalogItems } from '@/lib/mockData';
import { useAuthStore } from '@/stores/authStore';
import type { CatalogItem } from '@/types';
import { clsx } from 'clsx';

export function CatalogPage() {
  const { type } = useParams<{ type: string }>();
  const catalogType = type === 'apps' ? 'app' : 'agent';
  const user = useAuthStore((s) => s.user);

  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const items = mockCatalogItems
    .filter((i) => i.type === catalogType)
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase()) || i.description.toLowerCase().includes(query.toLowerCase()));

  const canEdit = user?.role === 'admin' || user?.role === 'power_user';
  const canDelete = user?.role === 'admin';

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-border">
          <h1 className="text-lg font-semibold text-text-primary mb-3">
            {catalogType === 'agent' ? 'Agent Catalog' : 'App Catalog'}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-border rounded-lg flex-1 max-w-sm">
              <Search size={16} className="text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${catalogType}s...`}
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-text-muted"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-sm text-text-secondary bg-white"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('card')} className={clsx('p-2 transition-colors', viewMode === 'card' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:bg-surface-secondary')}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:bg-surface-secondary')}>
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={clsx(
                    'text-left p-4 bg-white rounded-xl border transition-all hover:shadow-md',
                    selected?.id === item.id ? 'border-brand shadow-md' : 'border-border',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', item.type === 'agent' ? 'bg-brand/10' : 'bg-success/10')}>
                      {item.type === 'agent' ? <Bot size={20} className="text-brand" /> : <AppWindow size={20} className="text-success" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary truncate">{item.name}</h3>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={clsx('px-2 py-0.5 text-xs rounded-full', item.status === 'published' ? 'bg-success/10 text-success' : item.status === 'draft' ? 'bg-warning/10 text-warning' : 'bg-surface-tertiary text-text-muted')}>
                      {item.status}
                    </span>
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-surface-tertiary text-text-muted rounded-full">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><User size={12} /> {item.owner_name}</span>
                    <span className="flex items-center gap-1"><Eye size={12} /> {item.usage_count} uses</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-text-muted">Name</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-text-muted">Owner</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-text-muted">Status</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-text-muted">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} onClick={() => setSelected(item)} className={clsx('border-b border-border-light cursor-pointer hover:bg-surface-secondary transition-colors', selected?.id === item.id && 'bg-brand/5')}>
                      <td className="py-3 px-4 font-medium text-text-primary">{item.name}</td>
                      <td className="py-3 px-4 text-text-secondary">{item.owner_name}</td>
                      <td className="py-3 px-4">
                        <span className={clsx('px-2 py-0.5 text-xs rounded-full', item.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-muted">{item.usage_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Rollup Panel */}
      {selected && (
        <div className="w-96 border-l border-border bg-white shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Details</h3>
            <button onClick={() => setSelected(null)} className="p-1 text-text-muted hover:text-text-secondary rounded">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', selected.type === 'agent' ? 'bg-brand/10' : 'bg-success/10')}>
                {selected.type === 'agent' ? <Bot size={24} className="text-brand" /> : <AppWindow size={24} className="text-success" />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">{selected.name}</h2>
                <span className={clsx('px-2 py-0.5 text-xs rounded-full', selected.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                  {selected.status}
                </span>
              </div>
            </div>

            <p className="text-sm text-text-secondary">{selected.description}</p>

            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-text-muted">Owner</span><span className="text-text-primary">{selected.owner_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Visibility</span><span className="text-text-primary capitalize">{selected.visibility}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Uses</span><span className="text-text-primary">{selected.usage_count}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Updated</span><span className="text-text-primary">{new Date(selected.updated_at).toLocaleDateString()}</span></div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-surface-tertiary text-text-muted rounded-full">{tag}</span>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button className="flex items-center gap-2 w-full px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors">
                <Play size={16} /> Use
              </button>
              <button className="flex items-center gap-2 w-full px-4 py-2.5 border border-border text-sm font-medium text-text-primary rounded-lg hover:bg-surface-secondary transition-colors">
                <Copy size={16} /> Clone
              </button>
              {canEdit && (
                <button className="flex items-center gap-2 w-full px-4 py-2.5 border border-border text-sm font-medium text-text-primary rounded-lg hover:bg-surface-secondary transition-colors">
                  <Pencil size={16} /> Edit
                </button>
              )}
              {canEdit && (
                <button className="flex items-center gap-2 w-full px-4 py-2.5 border border-border text-sm font-medium text-text-primary rounded-lg hover:bg-surface-secondary transition-colors">
                  <ArrowRight size={16} /> Move
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 border border-danger/30 text-sm font-medium text-danger rounded-lg hover:bg-danger/5 transition-colors"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </div>

          {/* Delete confirmation modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-text-primary mb-2">Delete Item</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Are you sure you want to delete <strong>{selected.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-secondary">
                    Cancel
                  </button>
                  <button onClick={() => { setShowDeleteModal(false); setSelected(null); }} className="px-4 py-2 text-sm text-white bg-danger rounded-lg hover:bg-red-600">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
