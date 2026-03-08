'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

export function SuggestionPanel({
  reservationId,
  messageId,
  messageBody,
  initialSuggestion,
}: {
  reservationId: string;
  messageId: string;
  messageBody: string;
  initialSuggestion: string | null;
}) {
  const { getToken } = useAuth();
  const [suggestion, setSuggestion] = useState(initialSuggestion);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/inbox/${reservationId}/suggest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messageId }),
      });
      const data = (await res.json()) as { suggestion?: string };
      if (data.suggestion) setSuggestion(data.suggestion);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!suggestion) return;
    await navigator.clipboard.writeText(suggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
          Suggested reply
        </p>
        {suggestion && (
          <div className="flex gap-2">
            <button
              onClick={() => void copy()}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => void generate()}
              disabled={loading}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
        )}
      </div>

      {/* Guest message context */}
      <div className="rounded-md bg-white/70 border border-blue-100 px-3 py-2">
        <p className="text-xs text-gray-400 mb-0.5">Guest said</p>
        <p className="text-xs text-gray-600 line-clamp-3">{messageBody}</p>
      </div>

      {suggestion ? (
        <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{suggestion}</p>
      ) : (
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="w-full rounded-md border border-blue-200 bg-white py-2 text-sm text-blue-700 font-medium hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'Generating reply…' : 'Generate reply'}
        </button>
      )}
    </div>
  );
}
