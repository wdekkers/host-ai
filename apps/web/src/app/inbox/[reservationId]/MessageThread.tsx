'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type SerializedMessage = {
  id: string;
  reservationId: string;
  body: string;
  senderType: string;
  senderFullName: string | null;
  createdAt: string; // ISO string
};

function formatTime(isoDate: string) {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function MessageThread({
  reservationId,
  initialMessages,
  initialHasMore,
}: {
  reservationId: string;
  initialMessages: SerializedMessage[];
  initialHasMore: boolean;
}) {
  const { getToken } = useAuth();
  const [msgs, setMsgs] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollInfoRef = useRef<{ scrollY: number; scrollHeight: number } | null>(null);
  // Refs to avoid stale closures in IntersectionObserver
  const stateRef = useRef({ msgs, hasMore, loading });
  useEffect(() => {
    stateRef.current = { msgs, hasMore, loading };
  }, [msgs, hasMore, loading]);

  // Scroll to bottom on first render
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
  }, []);

  // After prepending older messages, restore the visual scroll position
  useLayoutEffect(() => {
    if (prevScrollInfoRef.current) {
      const { scrollY, scrollHeight } = prevScrollInfoRef.current;
      window.scrollTo({
        top: scrollY + (document.body.scrollHeight - scrollHeight),
        behavior: 'instant' as ScrollBehavior,
      });
      prevScrollInfoRef.current = null;
    }
  }, [msgs]);

  async function loadMore() {
    const {
      msgs: currentMsgs,
      hasMore: currentHasMore,
      loading: currentLoading,
    } = stateRef.current;
    if (currentLoading || !currentHasMore || currentMsgs.length === 0) return;

    setLoading(true);
    prevScrollInfoRef.current = {
      scrollY: window.scrollY,
      scrollHeight: document.body.scrollHeight,
    };

    try {
      const oldest = currentMsgs[0]!;
      const token = await getToken();
      const res = await fetch(
        `/api/inbox/${reservationId}/messages?before=${encodeURIComponent(oldest.createdAt)}&limit=20`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: SerializedMessage[]; hasMore: boolean };
      setMsgs((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }

  // Single IntersectionObserver on the sentinel div (top of list).
  // 300 ms delay prevents immediate trigger when only a few messages are shown.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && stateRef.current.hasMore) {
            void loadMore();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(sentinel);
    }, 300);

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Sentinel / load-more trigger at the top */}
      <div ref={sentinelRef} className="flex justify-center py-2 min-h-[1px]">
        {hasMore &&
          (loading ? (
            <span className="text-xs text-gray-400">Loading older messages…</span>
          ) : (
            <button
              onClick={() => void loadMore()}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Load older messages
            </button>
          ))}
      </div>

      {msgs.map((msg) => {
        const isHost = msg.senderType === 'host';
        return (
          <div key={msg.id} className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] ${isHost ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  isHost
                    ? 'bg-gray-900 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.body}
              </div>
              <div
                className={`flex items-center gap-2 mt-1 px-1 ${isHost ? 'flex-row-reverse' : ''}`}
              >
                <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                {msg.senderFullName && (
                  <span className="text-xs text-gray-400">{msg.senderFullName}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Anchor for scrolling to bottom on mount */}
      <div ref={bottomRef} />
    </div>
  );
}
