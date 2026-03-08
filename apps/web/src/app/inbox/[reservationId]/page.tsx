import { and, count, desc, eq, gt } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { messages, reservations } from '@walt/db';
import { db } from '@/lib/db';

import { MessageThread } from './MessageThread';
import type { SerializedMessage } from './MessageThread';
import { SuggestionPanel } from './SuggestionPanel';

const INITIAL_COUNT = 5;

function formatDate(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Total count for the header
  const countResult = await db
    .select({ value: count() })
    .from(messages)
    .where(eq(messages.reservationId, reservationId));
  const totalCount = countResult[0]?.value ?? 0;

  // Fetch INITIAL_COUNT + 1 to know if there are older messages
  const recent = await db
    .select()
    .from(messages)
    .where(eq(messages.reservationId, reservationId))
    .orderBy(desc(messages.createdAt))
    .limit(INITIAL_COUNT + 1);

  const hasMore = recent.length > INITIAL_COUNT;
  const initialMessages: SerializedMessage[] = recent
    .slice(0, INITIAL_COUNT)
    .reverse()
    .map((m) => ({
      id: m.id,
      reservationId: m.reservationId,
      body: m.body,
      senderType: m.senderType,
      senderFullName: m.senderFullName,
      createdAt: m.createdAt.toISOString(),
    }));

  // Find the latest guest message that has no subsequent host reply
  const [lastGuestMsg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.reservationId, reservationId), eq(messages.senderType, 'guest')))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  let unrepliedGuestMsg: typeof lastGuestMsg | null = null;
  if (lastGuestMsg) {
    const [laterHostMsg] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.reservationId, reservationId),
          eq(messages.senderType, 'host'),
          gt(messages.createdAt, lastGuestMsg.createdAt),
        ),
      )
      .limit(1);
    if (!laterHostMsg) unrepliedGuestMsg = lastGuestMsg;
  }

  const guestName =
    [reservation.guestFirstName, reservation.guestLastName].filter(Boolean).join(' ') || 'Guest';

  return (
    <div className="p-4 sm:p-8">
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
            {totalCount}
          </div>
        </div>
      </div>

      {/* Two-column: messages + suggestion panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Messages */}
        <div className="flex-1 min-w-0">
          {totalCount === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 text-sm">
              No messages for this reservation.
            </div>
          ) : (
            <MessageThread
              reservationId={reservationId}
              initialMessages={initialMessages}
              initialHasMore={hasMore}
            />
          )}
        </div>

        {/* Suggestion panel — only when there's an unreplied guest message */}
        {unrepliedGuestMsg && (
          <div className="w-full lg:w-80 flex-shrink-0">
            <SuggestionPanel
              reservationId={reservationId}
              messageId={unrepliedGuestMsg.id}
              messageBody={unrepliedGuestMsg.body}
              initialSuggestion={unrepliedGuestMsg.suggestion}
            />
          </div>
        )}
      </div>
    </div>
  );
}
