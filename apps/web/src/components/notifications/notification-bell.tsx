'use client';

import type React from 'react';
import { useAuth } from '@clerk/nextjs';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationItem } from './notification-item';

type NotificationRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  items: NotificationRow[];
  unreadCount: number;
};

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell(): React.ReactElement {
  const { getToken } = useAuth();
  const [data, setData] = useState<NotificationsResponse>({ items: [], unreadCount: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const token = await getToken();
      const res = await fetch('/api/notifications?limit=8', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = (await res.json()) as NotificationsResponse;
        setData(json);
      }
    } catch {
      // silently ignore fetch errors
    }
  }, [getToken]);

  useEffect(() => {
    void fetchNotifications();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    intervalRef.current = setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const token = await getToken();
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setData((prev) => ({
        ...prev,
        unreadCount: 0,
        items: prev.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      }));
    } catch {
      // silently ignore
    }
  };

  const handleItemClick = async (id: string) => {
    try {
      const token = await getToken();
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setData((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        items: prev.items.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      }));
    } catch {
      // silently ignore
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-500" />
        {data.unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold text-white leading-none">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="text-xs text-sky-600 hover:text-sky-700"
          >
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {data.items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">No notifications</p>
          ) : (
            data.items.slice(0, 8).map((notification) => (
              <NotificationItem
                key={notification.id}
                id={notification.id}
                category={notification.category}
                title={notification.title}
                body={notification.body}
                readAt={notification.readAt}
                createdAt={notification.createdAt}
                onClick={(id) => void handleItemClick(id)}
              />
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-3 py-2">
          <Link
            href="/notifications"
            className="block text-center text-xs text-sky-600 hover:text-sky-700"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
