'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AiDraftPanel } from './AiDraftPanel';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE_CONFIG, STATUS_ICONS, STATUS_COLORS } from './status-config';

type Message = {
  id: string;
  reservationId: string;
  body: string;
  senderType: string;
  senderFullName: string | null;
  createdAt: string;
  raw: unknown;
};

type ReservationInfo = {
  guestFirstName: string | null;
  guestLastName: string | null;
  propertyName: string | null;
  propertyId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
  status: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ConversationThread({
  reservationId,
  onBack,
}: {
  reservationId: string;
  onBack: () => void;
}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef(false);

  // Scroll to bottom after React renders new messages
  useEffect(() => {
    if (!loading && shouldScrollToBottom.current) {
      shouldScrollToBottom.current = false;
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [loading, messages]);

  const fetchMessages = useCallback(
    async (before?: string) => {
      const token = await getToken();
      const params = new URLSearchParams({ limit: '20' });
      if (before) params.set('before', before);
      const res = await fetch(`/api/inbox/${reservationId}/messages?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = (await res.json()) as {
        messages: Message[];
        hasMore: boolean;
        reservation: ReservationInfo;
      };
      return data;
    },
    [reservationId, getToken],
  );

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    void fetchMessages().then((data) => {
      shouldScrollToBottom.current = true;
      setMessages(data.messages);
      setReservation(data.reservation);
      setHasMore(data.hasMore);
      setLoading(false);
    });
  }, [reservationId, fetchMessages]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    const oldest = messages[0]?.createdAt;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const data = await fetchMessages(oldest);
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, messages, fetchMessages]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingOlder) {
          void loadOlder();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, loadOlder]);

  const latestNonSystem = [...messages].reverse().find((m) => m.senderType !== 'system');
  const latestIsGuest = latestNonSystem?.senderType === 'guest';
  const unrepliedMessage = latestIsGuest ? (latestNonSystem ?? null) : null;
  const latestGuestMessage = [...messages].reverse().find((m) => m.senderType === 'guest') ?? null;

  const guestName =
    [reservation?.guestFirstName, reservation?.guestLastName].filter(Boolean).join(' ') || 'Guest';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <button onClick={onBack} className="md:hidden text-sm mr-1 text-slate-400">
          ←
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-sky-600 text-white">
          {initials(guestName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{guestName}</p>
            {(() => {
              const statusConfig = reservation?.status ? STATUS_BADGE_CONFIG[reservation.status] : undefined;
              return statusConfig ? (
                <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
              ) : null;
            })()}
          </div>
          <p className="text-xs truncate text-slate-500">
            {reservation?.propertyName ?? '—'}
            {reservation?.checkIn &&
              ` · ${new Date(reservation.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            {reservation?.checkOut &&
              ` – ${new Date(reservation.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            {reservation?.platform && ` · ${reservation.platform}`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-xs text-center text-slate-400">Loading…</p>
        ) : (
          <>
            {hasMore && (
              <div ref={topSentinelRef} className="py-1 text-xs text-center text-slate-400">
                {loadingOlder ? 'Loading…' : ''}
              </div>
            )}
            {messages.map((m) => {
              // System event card
              if (m.senderType === 'system') {
                const rawData = m.raw as { toStatus?: string } | null;
                const statusKey = rawData?.toStatus ?? undefined;
                const Icon = statusKey ? STATUS_ICONS[statusKey] : null;
                const color = statusKey ? STATUS_COLORS[statusKey] : 'text-slate-500';

                return (
                  <div key={m.id} className="flex justify-center my-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
                      {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
                      <span className={`text-xs font-medium ${color}`}>{m.body}</span>
                      <span className="text-xs text-slate-400">
                        · {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              }

              // Regular message bubble
              const isHost = m.senderType === 'host';
              const isUnreplied = m === unrepliedMessage;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 max-w-[75%] ${isHost ? 'self-end flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isHost ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {initials(m.senderFullName ?? (isHost ? 'Host' : guestName))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div
                      className={`px-3 py-2 text-xs leading-relaxed ${
                        isHost ? 'bg-sky-600 text-white' : 'bg-white text-slate-800'
                      }`}
                      style={{
                        borderRadius: isHost ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                        border: isUnreplied
                          ? '1px solid #0284c7'
                          : isHost
                            ? 'none'
                            : '1px solid #e2e8f0',
                      }}
                    >
                      {m.body}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-xs text-slate-400 ${isHost ? 'justify-end' : ''}`}
                    >
                      <span>{formatTime(m.createdAt)}</span>
                      {isUnreplied && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600">
                          needs reply
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {reservation && (
        <AiDraftPanel
          reservationId={reservationId}
          propertyId={reservation.propertyId}
          unrepliedMessage={unrepliedMessage}
          latestGuestMessage={latestGuestMessage}
          onSent={() => {
            void fetchMessages().then((data) => {
              shouldScrollToBottom.current = true;
              setMessages(data.messages);
              setHasMore(data.hasMore);
            });
          }}
        />
      )}
    </div>
  );
}
