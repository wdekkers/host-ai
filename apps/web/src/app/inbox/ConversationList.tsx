'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import type { InboxThread } from './InboxClient';

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
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ filter, search, per_page: '50' });
      const res = await fetch(`/api/inbox?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = (await res.json()) as { threads: InboxThread[]; total: number };
      setThreads(data.threads ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter, search, getToken]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  const unrepliedCount = threads.filter((t) => t.unreplied).length;
  const aiReadyCount = threads.filter((t) => t.aiReady).length;

  return (
    <div className="flex flex-col h-full w-full" style={{ background: '#0d1f38' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: '#1a3a5c' }}>
        <h1 className="text-sm font-bold mb-3" style={{ color: '#e2e8f0' }}>
          Inbox
        </h1>
        <input
          type="text"
          placeholder="Search guests or properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
          style={{
            background: '#071428',
            borderColor: '#1a3a5c',
            color: '#94a3b8',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex border-b" style={{ borderColor: '#1a3a5c' }}>
        {(['all', 'unreplied', 'ai_ready'] as Filter[]).map((f) => {
          const label = f === 'all' ? 'All' : f === 'unreplied' ? 'Unreplied' : 'AI Ready';
          const badge = f === 'unreplied' ? unrepliedCount : f === 'ai_ready' ? aiReadyCount : null;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors"
              style={{
                borderColor: active ? '#3b82f6' : 'transparent',
                color: active ? '#60a5fa' : '#475569',
              }}
            >
              {label}
              {badge != null && badge > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: '#1d4ed8', color: '#93c5fd', fontSize: '9px' }}
                >
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
          <div className="p-4 text-xs text-center" style={{ color: '#334155' }}>
            Loading…
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-xs text-center" style={{ color: '#334155' }}>
            No conversations
          </div>
        ) : (
          threads.map((t) => (
            <button
              key={t.reservationId}
              onClick={() => onSelect(t.reservationId)}
              className="w-full text-left px-4 py-3 border-b transition-colors"
              style={{
                borderColor: '#122038',
                background: t.reservationId === selectedId ? '#0f2d52' : 'transparent',
                borderLeft:
                  t.reservationId === selectedId ? '3px solid #3b82f6' : '3px solid transparent',
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: t.unreplied ? '#f1f5f9' : '#cbd5e1' }}
                  >
                    {t.guestName}
                  </span>
                  {t.unreplied && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#3b82f6' }}
                    />
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                  {formatRelativeTime(t.lastMessageAt)}
                </span>
              </div>
              <p className="text-xs truncate mb-1.5" style={{ color: '#64748b' }}>
                {t.lastBody}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#334155' }}>
                  {t.propertyName ?? '—'}
                </span>
                {t.aiReady ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full border"
                    style={{
                      background: '#1e3a5f',
                      color: '#60a5fa',
                      borderColor: '#1d4ed8',
                      fontSize: '9px',
                    }}
                  >
                    ✦ AI draft
                  </span>
                ) : t.unreplied ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full border"
                    style={{
                      background: '#1a1a2e',
                      color: '#f87171',
                      borderColor: '#991b1b',
                      fontSize: '9px',
                    }}
                  >
                    unreplied
                  </span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
