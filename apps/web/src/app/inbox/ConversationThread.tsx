'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AiDraftPanel } from './AiDraftPanel';

type Message = {
  id: string;
  reservationId: string;
  body: string;
  senderType: string;
  senderFullName: string | null;
  createdAt: string;
};

type ReservationInfo = {
  guestFirstName: string | null;
  guestLastName: string | null;
  propertyName: string | null;
  propertyId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
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

  const latestIsGuest =
    messages.length > 0 && messages[messages.length - 1]?.senderType === 'guest';
  const unrepliedMessage = latestIsGuest ? (messages[messages.length - 1] ?? null) : null;

  const guestName =
    [reservation?.guestFirstName, reservation?.guestLastName].filter(Boolean).join(' ') || 'Guest';

  return (
    <div className="flex flex-col h-full" style={{ background: '#071428' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: '#1a3a5c' }}
      >
        <button onClick={onBack} className="md:hidden text-sm mr-1" style={{ color: '#475569' }}>
          ←
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          {initials(guestName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: '#f1f5f9' }}>
            {guestName}
          </p>
          <p className="text-xs truncate" style={{ color: '#475569' }}>
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
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-xs text-center" style={{ color: '#334155' }}>
            Loading…
          </p>
        ) : (
          <>
            {hasMore && (
              <div
                ref={topSentinelRef}
                className="py-1 text-xs text-center"
                style={{ color: '#334155' }}
              >
                {loadingOlder ? 'Loading…' : ''}
              </div>
            )}
            {messages.map((m) => {
              const isHost = m.senderType === 'host';
              const isUnreplied = m === unrepliedMessage;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 max-w-[75%] ${isHost ? 'self-end flex-row-reverse' : ''}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: isHost ? '#1d4ed8' : '#1e293b',
                      color: isHost ? '#fff' : '#94a3b8',
                    }}
                  >
                    {initials(m.senderFullName ?? (isHost ? 'Host' : guestName))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div
                      className="px-3 py-2 text-xs leading-relaxed"
                      style={{
                        background: isHost ? '#1d4ed8' : '#0d1f38',
                        color: isHost ? '#eff6ff' : '#e2e8f0',
                        borderRadius: isHost ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                        border: isUnreplied
                          ? '1px solid #3b82f6'
                          : isHost
                            ? 'none'
                            : '1px solid #1a3a5c',
                      }}
                    >
                      {m.body}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-xs ${isHost ? 'justify-end' : ''}`}
                      style={{ color: '#334155' }}
                    >
                      <span>{formatTime(m.createdAt)}</span>
                      {isUnreplied && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '9px' }}
                        >
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
      </div>

      {reservation && (
        <AiDraftPanel
          reservationId={reservationId}
          propertyId={reservation.propertyId}
          unrepliedMessage={unrepliedMessage}
          onSent={() => {
            void fetchMessages().then((data) => {
              setMessages(data.messages);
              setHasMore(data.hasMore);
            });
          }}
        />
      )}
    </div>
  );
}
