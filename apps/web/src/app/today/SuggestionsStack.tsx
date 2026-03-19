'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TaskSuggestion } from '@walt/contracts';
import { SuggestionCard } from './SuggestionCard';

export function SuggestionsStack() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSuggestions() {
    try {
      const res = await fetch('/api/task-suggestions?status=pending');
      if (res.ok) {
        const body = (await res.json()) as { suggestions: TaskSuggestion[] };
        setSuggestions(body.suggestions);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSuggestions();

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        router.refresh(); // re-run server component (turnovers + tasks)
        void fetchSuggestions(); // re-fetch client suggestions
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [router]);

  if (loading || suggestions.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-3">
        {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
      </h2>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onAccepted={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
            onDismissed={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </section>
  );
}
