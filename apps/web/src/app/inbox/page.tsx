import { desc, eq } from 'drizzle-orm';
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

function truncate(text: string, maxLen = 120) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

export default async function InboxPage() {
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      senderType: messages.senderType,
      senderFullName: messages.senderFullName,
      createdAt: messages.createdAt,
      suggestion: messages.suggestion,
      reservationId: messages.reservationId,
      guestFirstName: reservations.guestFirstName,
      guestLastName: reservations.guestLastName
    })
    .from(messages)
    .leftJoin(reservations, eq(messages.reservationId, reservations.id))
    .where(eq(messages.senderType, 'guest'))
    .orderBy(desc(messages.createdAt))
    .limit(100);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">
          {rows.length} message{rows.length !== 1 ? 's' : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No messages yet. Sync reservations or wait for webhook messages.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
          {rows.map((msg) => {
            const guestName =
              [msg.guestFirstName, msg.guestLastName].filter(Boolean).join(' ') ||
              msg.senderFullName ||
              'Guest';
            return (
              <div key={msg.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">{guestName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">Reservation {msg.reservationId}</span>
                    </div>
                    <p className="text-sm text-gray-600">{truncate(msg.body)}</p>
                    {msg.suggestion && (
                      <div className="mt-2 rounded bg-blue-50 border border-blue-100 px-3 py-2">
                        <p className="text-xs font-medium text-blue-600 mb-1">Suggested reply</p>
                        <p className="text-sm text-blue-900">{msg.suggestion}</p>
                      </div>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                    {formatRelativeTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
