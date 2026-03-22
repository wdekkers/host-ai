'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import type { InboxThread } from './InboxClient';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE_CONFIG } from './status-config';

type Filter = 'all' | 'unreplied' | 'ai_ready';

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ filter, search: debouncedSearch, per_page: '50' });
      const res = await fetch(`/api/inbox?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = (await res.json()) as { threads: InboxThread[]; total: number };
      setThreads(data.threads ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, getToken]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  const unrepliedCount = threads.filter((t) => t.unreplied).length;
  const aiReadyCount = threads.filter((t) => t.aiReady).length;

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200">
        <h1 className="text-sm font-bold mb-3 text-slate-900">Inbox</h1>
        <input
          type="text"
          placeholder="Search guests or properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-500"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-slate-200">
        {(['all', 'unreplied', 'ai_ready'] as Filter[]).map((f) => {
          const label = f === 'all' ? 'All' : f === 'unreplied' ? 'Unreplied' : 'AI Ready';
          const badge = f === 'unreplied' ? unrepliedCount : f === 'ai_ready' ? aiReadyCount : null;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${
                active
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
              {badge != null && badge > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs text-center text-slate-400">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-xs text-center text-slate-400">No conversations</div>
        ) : (
          threads.map((t) => {
            const statusBadge = t.status ? STATUS_BADGE_CONFIG[t.status] : undefined;
            return (
            <button
              key={t.reservationId}
              onClick={() => onSelect(t.reservationId)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                t.reservationId === selectedId ? 'bg-sky-50' : 'hover:bg-slate-50'
              }`}
              style={{
                borderLeft:
                  t.reservationId === selectedId
                    ? '3px solid #0284c7'
                    : '3px solid transparent',
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${t.unreplied ? 'text-slate-900' : 'text-slate-700'}`}
                  >
                    {t.guestName}
                  </span>
                  {statusBadge && (
                    <Badge className={`text-[9px] h-4 ${statusBadge.className}`}>
                      {statusBadge.label}
                    </Badge>
                  )}
                  {t.guestScore != null && (
                    <Badge
                      className={`text-[9px] h-4 border-0 ${
                        t.guestScore >= 8
                          ? 'bg-green-100 text-green-700'
                          : t.guestScore >= 5
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {t.guestScore}/10
                    </Badge>
                  )}
                  {t.unreplied && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-sky-600" />
                  )}
                </div>
                <span className="text-xs flex-shrink-0 text-slate-400">
                  {formatRelativeTime(t.lastMessageAt)}
                </span>
              </div>
              <p className={`text-xs truncate mb-1.5 text-slate-500 ${t.lastSenderType === 'system' ? 'italic' : ''}`}>{t.lastBody}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">{t.propertyName ?? '—'}</span>
                {t.aiReady ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-sky-50 text-sky-600 border-sky-200">
                    ✦ AI draft
                  </span>
                ) : t.unreplied ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                    unreplied
                  </span>
                ) : null}
              </div>
            </button>
            );
          })
        )}
      </div>
    </div>
  );
}
