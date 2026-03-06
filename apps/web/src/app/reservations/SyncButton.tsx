'use client';

import { useState } from 'react';

export default function SyncButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState<string | null>(null);

  async function handleSync() {
    setState('loading');
    setSummary(null);
    try {
      const res = await fetch('/api/admin/sync-hospitable', { method: 'POST' });
      const json = (await res.json()) as { reservations?: number; messages?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Sync failed');
      setSummary(`Synced ${json.reservations ?? 0} reservations and ${json.messages ?? 0} messages.`);
      setState('done');
      // Reload to show fresh data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setSummary(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={state === 'loading'}
        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'loading' ? 'Syncing…' : 'Sync from Hospitable'}
      </button>
      {summary && (
        <span className={`text-sm ${state === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {summary}
        </span>
      )}
    </div>
  );
}
