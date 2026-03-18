'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RunSeoDraftsButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/command-center/seo-drafts/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketKey: 'frisco-tx', siteKey: 'stayinfrisco' }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || body.error) {
        setError(body.error ?? 'Unable to run SEO draft pipeline');
        return;
      }

      startTransition(() => router.refresh());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to run SEO draft pipeline');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void run()}
        disabled={loading}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Run Frisco SEO Drafts'}
      </button>
      {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
    </div>
  );
}
