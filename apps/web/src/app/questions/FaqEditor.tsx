'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RunAnalysisButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analyze-questions', { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (data.error) {
        setError(data.error);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? 'Analysing…' : 'Run Analysis'}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export function AnswerEditor({
  faqId,
  initialAnswer,
}: {
  faqId: string;
  initialAnswer: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState(initialAnswer ?? '');
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/admin/property-faqs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: faqId, answer }),
      });
      setEditing(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="rounded bg-blue-50 border border-blue-100 p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">Answer</p>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            Edit
          </button>
        </div>
        <p className="text-sm text-blue-900">
          {answer || <span className="italic text-blue-400">No answer yet</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded bg-blue-50 border border-blue-100 p-3">
      <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-2">Answer</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        className="w-full text-sm border border-blue-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1 bg-blue-700 text-white text-xs rounded hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => {
            setAnswer(initialAnswer ?? '');
            setEditing(false);
          }}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
