type Message = {
  id: string;
  reservationId: string;
  guestName: string;
  message: string;
  sentAt: string;
};

type ApiResponse = {
  error?: string;
  count?: number;
  items?: Message[];
};

function formatRelativeTime(dateStr: string) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
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
  } catch {
    return dateStr;
  }
}

function truncate(text: string, maxLen = 120) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

async function fetchMessages(): Promise<ApiResponse> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/integrations/hospitable/messages?limit=100`, {
    cache: 'no-store'
  });
  return res.json() as Promise<ApiResponse>;
}

export default async function InboxPage() {
  const data = await fetchMessages();

  if (data.error?.includes('not configured')) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-6">Inbox</h1>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          Integration not configured. Set <code className="font-mono text-sm">HOSPITABLE_API_KEY</code> and{' '}
          <code className="font-mono text-sm">HOSPITABLE_BASE_URL</code> environment variables.
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-6">Inbox</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          Error loading messages: {data.error}
        </div>
      </div>
    );
  }

  const messages = (data.items ?? []).sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No messages found.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
          {messages.map((msg) => (
            <div key={msg.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">{msg.guestName}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">Reservation {msg.reservationId}</span>
                  </div>
                  <p className="text-sm text-gray-600">{truncate(msg.message)}</p>
                </div>
                <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">{formatRelativeTime(msg.sentAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
