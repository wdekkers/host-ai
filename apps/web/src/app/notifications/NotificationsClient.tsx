'use client';

import type React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { Card } from '@/components/ui/card';
import { NotificationItem } from '@/components/notifications/notification-item';

type Notification = {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type CategoryFilter = 'all' | 'escalation' | 'upsell' | 'journey' | 'task';

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'journey', label: 'Journey' },
  { value: 'task', label: 'Task' },
];

const PAGE_SIZE = 50;

export function NotificationsClient(): React.ReactElement {
  const [items, setItems] = useState<Notification[]>([]);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();

  const fetchNotifications = useCallback(
    async (cat: CategoryFilter, nextOffset: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cat !== 'all') params.set('category', cat);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(nextOffset));

        const res = await fetch(`/api/notifications?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!res.ok) return;

        const data = (await res.json()) as { items?: Notification[] };
        const fetched = data.items ?? [];

        setItems((prev) => (append ? [...prev, ...fetched] : fetched));
        setHasMore(fetched.length === PAGE_SIZE);
        setOffset(nextOffset + fetched.length);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchNotifications(category, 0, false);
  }, [category, fetchNotifications]);

  function handleCategoryChange(next: CategoryFilter) {
    setCategory(next);
    setOffset(0);
  }

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    });
  }

  function handleLoadMore() {
    void fetchNotifications(category, offset, true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Mark all read
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleCategoryChange(tab.value)}
            className={
              category === tab.value
                ? 'rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {loading && items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading notifications...</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">No notifications</p>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {items.map((item) => (
            <NotificationItem
              key={item.id}
              id={item.id}
              category={item.category}
              title={item.title}
              body={item.body}
              readAt={item.readAt}
              createdAt={item.createdAt}
              onClick={handleMarkRead}
            />
          ))}
        </Card>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
