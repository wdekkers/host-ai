'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

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
const TOAST_DURATION_MS = 10_000;

export function UrgentToastProvider(): null {
  const { getToken } = useAuth();
  const seenIds = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollEscalations = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const token = await getToken();
      const res = await fetch('/api/notifications?category=escalation&limit=5', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const { items } = (await res.json()) as NotificationsResponse;
      for (const notification of items) {
        if (notification.readAt !== null) continue;
        if (seenIds.current.has(notification.id)) continue;
        seenIds.current.add(notification.id);
        toast.error(notification.title, {
          description: notification.body,
          duration: TOAST_DURATION_MS,
        });
      }
    } catch {
      // silently ignore
    }
  }, [getToken]);

  useEffect(() => {
    void pollEscalations();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void pollEscalations();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    intervalRef.current = setInterval(() => {
      void pollEscalations();
    }, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [pollEscalations]);

  return null;
}
