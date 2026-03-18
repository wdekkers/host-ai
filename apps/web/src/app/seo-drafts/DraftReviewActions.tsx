'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ReviewAction = 'approve' | 'reject' | 'needs_attention';

export function DraftReviewActions({
  draftId,
  currentStatus,
}: {
  draftId: string;
  currentStatus: string;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const statusLabel = currentStatus.replace(/_/g, ' ');

  async function submit(action: ReviewAction) {
    setPendingAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/command-center/seo-drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          note: note.trim().length > 0 ? note.trim() : undefined,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || body.error) {
        setError(body.error ?? 'Unable to update SEO draft');
        return;
      }

      setNote('');
      startTransition(() => router.refresh());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update SEO draft');
    } finally {
      setPendingAction(null);
    }
  }

  const isTerminalStatus = currentStatus === 'approved' || currentStatus === 'rejected';

  return (
    <div className="rounded bg-gray-50 border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Review Actions
      </p>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="Optional note for this review"
        className="w-full text-sm border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => void submit('approve')}
          disabled={pendingAction !== null}
          className="px-3 py-1 bg-green-700 text-white text-xs rounded hover:bg-green-800 disabled:opacity-50"
        >
          {pendingAction === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          onClick={() => void submit('reject')}
          disabled={pendingAction !== null}
          className="px-3 py-1 bg-red-700 text-white text-xs rounded hover:bg-red-800 disabled:opacity-50"
        >
          {pendingAction === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          onClick={() => void submit('needs_attention')}
          disabled={pendingAction !== null}
          className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {pendingAction === 'needs_attention' ? 'Updating…' : 'Needs Attention'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Current status: <span className="font-medium text-gray-700">{statusLabel}</span>
        {isTerminalStatus ? ' · review can still be revised if needed' : null}
      </p>
      {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
    </div>
  );
}
