import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { messages, reservations } from '@walt/db';
import { db } from '@/lib/db';

function formatDate(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;

  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId));

  if (!reservation) notFound();

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.reservationId, reservationId))
    .orderBy(desc(messages.createdAt))
    .limit(5);

  const guestName =
    [reservation.guestFirstName, reservation.guestLastName].filter(Boolean).join(' ') || 'Guest';

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Back link */}
      <Link
        href="/inbox"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1"
      >
        ← Inbox
      </Link>

      {/* Reservation header */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6 mt-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{guestName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{reservation.propertyName ?? '—'}</p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              reservation.status === 'accepted' || reservation.status === 'confirmed'
                ? 'bg-green-100 text-green-800'
                : reservation.status === 'cancelled' || reservation.status === 'canceled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {reservation.status ?? 'unknown'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">
              Check-in
            </span>
            {formatDate(reservation.checkIn)}
          </div>
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">
              Check-out
            </span>
            {formatDate(reservation.checkOut)}
          </div>
          {reservation.platform && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">
                Platform
              </span>
              <span className="capitalize">{reservation.platform}</span>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">
              Messages
            </span>
            {msgs.length} (latest)
          </div>
        </div>
      </div>

      {/* Messages */}
      {msgs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 text-sm">
          No messages for this reservation.
        </div>
      ) : (
        <div className="space-y-3">
          {msgs.map((msg) => {
            const isHost = msg.senderType === 'host';
            return (
              <div key={msg.id} className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] ${isHost ? 'items-end' : 'items-start'} flex flex-col`}
                >
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

                  {/* AI suggestion */}
                  {!isHost && msg.suggestion && (
                    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 max-w-full">
                      <p className="text-xs font-medium text-blue-600 mb-1">Suggested reply</p>
                      <p className="text-sm text-blue-900 whitespace-pre-wrap">{msg.suggestion}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
