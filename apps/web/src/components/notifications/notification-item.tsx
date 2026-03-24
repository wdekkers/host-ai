'use client';

import type React from 'react';

import { Badge } from '@/components/ui/badge';

type NotificationCategory = 'escalation' | 'upsell' | 'journey' | 'task' | 'system';

type NotificationItemProps = {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  onClick: (id: string) => void;
};

function relativeTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function getCategoryBadge(category: string): { label: string; className: string } {
  switch (category as NotificationCategory) {
    case 'escalation':
      return { label: 'URGENT', className: 'bg-red-50 text-red-600 border-transparent' };
    case 'upsell':
      return { label: 'UPSELL', className: 'bg-green-50 text-green-800 border-transparent' };
    case 'journey':
      return { label: 'JOURNEY', className: 'bg-amber-50 text-amber-800 border-transparent' };
    case 'task':
      return { label: 'TASK', className: 'bg-slate-100 text-slate-600 border-transparent' };
    default:
      return { label: 'SYSTEM', className: 'bg-slate-100 text-slate-600 border-transparent' };
  }
}

export function NotificationItem({
  id,
  category,
  title,
  body,
  readAt,
  createdAt,
  onClick,
}: NotificationItemProps): React.ReactElement {
  const isUnread = readAt === null;
  const badge = getCategoryBadge(category);

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${isUnread ? 'opacity-100' : 'opacity-60'}`}
    >
      <div className="flex items-start gap-2">
        {isUnread && (
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        )}
        {!isUnread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge className={badge.className}>{badge.label}</Badge>
            <span className="text-[11px] text-slate-400 ml-auto">{relativeTime(createdAt)}</span>
          </div>
          <p className="text-xs font-medium text-slate-900 leading-tight">{title}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{body}</p>
        </div>
      </div>
    </button>
  );
}
