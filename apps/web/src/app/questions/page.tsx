'use client';
import { useState } from 'react';

type Category = {
  name: string;
  count: number;
  examples: string[];
  suggestedAnswer: string;
};

export default function QuestionsPage() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analyze-questions', { method: 'POST' });
      const data = (await res.json()) as { categories?: Category[]; error?: string; totalMessages?: number };
      if (data.error) {
        setError(data.error);
        return;
      }
      setCategories(data.categories ?? []);
      setTotal(data.totalMessages ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Common Questions</h1>
          {total !== null && (
            <p className="text-sm text-gray-500 mt-1">Analysed {total} guest messages</p>
          )}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Analysing…' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm mb-6">
          {error}
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          Click "Run Analysis" to discover common guest questions.
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.name} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-gray-900">{cat.name}</h2>
              <span className="text-xs text-gray-500">
                {cat.count} message{cat.count !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Examples</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {cat.examples.map((ex, i) => (
                  <li key={i} className="truncate">"{ex}"</li>
                ))}
              </ul>
            </div>
            <div className="rounded bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">
                Suggested Answer
              </p>
              <p className="text-sm text-blue-900">{cat.suggestedAnswer}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
