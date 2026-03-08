import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { messages, reservations } from '@walt/db';
import { db } from '@/lib/db';

function formatRelativeTime(date: Date | null) {
  if (!date) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncate(text: string, maxLen = 100) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;

  const baseQuery = db
    .select({
      id: messages.id,
      reservationId: messages.reservationId,
      body: messages.body,
      senderType: messages.senderType,
      senderFullName: messages.senderFullName,
      createdAt: messages.createdAt,
      guestFirstName: reservations.guestFirstName,
      guestLastName: reservations.guestLastName,
      propertyName: reservations.propertyName,
      checkIn: reservations.checkIn,
      checkOut: reservations.checkOut,
      status: reservations.status,
    })
    .from(messages)
    .leftJoin(reservations, eq(messages.reservationId, reservations.id))
    .orderBy(desc(messages.createdAt));

  const rows = await (propertyId
    ? baseQuery.where(eq(reservations.propertyId, propertyId))
    : baseQuery);

  // Group into threads by reservation, most-recently-active first
  type Thread = {
    reservationId: string;
    guestName: string;
    propertyName: string | null;
    checkIn: Date | null;
    checkOut: Date | null;
    status: string | null;
    lastBody: string;
    lastSenderType: string;
    lastMessageAt: Date;
    messageCount: number;
    hasUnrepliedGuest: boolean;
  };

  const threadMap = new Map<string, Thread>();
  for (const row of rows) {
    if (!threadMap.has(row.reservationId)) {
      const guestName =
        [row.guestFirstName, row.guestLastName].filter(Boolean).join(' ') ||
        row.senderFullName ||
        'Guest';
      threadMap.set(row.reservationId, {
        reservationId: row.reservationId,
        guestName,
        propertyName: row.propertyName,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        status: row.status,
        lastBody: row.body,
        lastSenderType: row.senderType,
        lastMessageAt: row.createdAt,
        messageCount: 0,
        hasUnrepliedGuest: false,
      });
    }
    const thread = threadMap.get(row.reservationId)!;
    thread.messageCount++;
    if (thread.lastSenderType === 'guest') thread.hasUnrepliedGuest = true;
  }

  const threads = [...threadMap.values()];
  const propertyName = rows[0]?.propertyName ?? null;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        {propertyId && (
          <Link
            href="/inbox"
            className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
          >
            ← All conversations
          </Link>
        )}
        <h1 className="text-2xl font-semibold">
          {propertyId && propertyName ? propertyName : 'Inbox'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {threads.length} conversation{threads.length !== 1 ? 's' : ''}
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          {propertyId
            ? 'No conversations for this property.'
            : 'No messages yet. Sync reservations first.'}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
          {threads.map((thread) => (
            <Link
              key={thread.reservationId}
              href={`/inbox/${thread.reservationId}`}
              className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Unread dot */}
              <div className="mt-1.5 flex-shrink-0 w-2">
                {thread.hasUnrepliedGuest && (
                  <span className="block w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={`text-sm ${thread.hasUnrepliedGuest ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}
                  >
                    {thread.guestName}
                  </span>
                  <span className="flex-shrink-0 text-xs text-gray-400">
                    {formatRelativeTime(thread.lastMessageAt)}
                  </span>
                </div>
                {!propertyId && (
                  <p className="text-xs text-gray-400 mb-1">
                    {thread.propertyName ?? '—'}
                    {thread.checkIn && (
                      <span className="ml-2">
                        ·{' '}
                        {thread.checkIn.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {thread.checkOut &&
                          ` – ${thread.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </span>
                    )}
                  </p>
                )}
                <p className="text-sm text-gray-500 truncate">
                  {thread.lastSenderType === 'host' && <span className="text-gray-400">You: </span>}
                  {truncate(thread.lastBody)}
                </p>
              </div>

              <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {thread.messageCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
