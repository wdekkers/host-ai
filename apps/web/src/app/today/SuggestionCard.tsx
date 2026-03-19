'use client';

import { useState } from 'react';
import type { TaskSuggestion } from '@walt/contracts';

type Props = {
  suggestion: TaskSuggestion;
  onAccepted: (id: string) => void;
  onDismissed: (id: string) => void;
};

export function SuggestionCard({ suggestion, onAccepted, onDismissed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(suggestion.title);
  const [dueDate, setDueDate] = useState(
    suggestion.suggestedDueDate ? suggestion.suggestedDueDate.slice(0, 16) : '',
  );
  const [smsChecked, setSmsChecked] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/task-suggestions/${suggestion.id}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reminderChannels: [
            ...(smsChecked ? (['sms'] as const) : []),
            ...(emailChecked ? (['email'] as const) : []),
          ],
          reminderTime: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      onAccepted(suggestion.id);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    await fetch(`/api/task-suggestions/${suggestion.id}/dismiss`, { method: 'POST' });
    onDismissed(suggestion.id);
  }

  return (
    <div className="rounded-lg bg-white border border-yellow-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-yellow-700 mb-1">{suggestion.propertyName}</div>
          <div className="text-sm font-medium text-gray-900">{suggestion.title}</div>
          {suggestion.description && (
            <div className="text-xs text-gray-500 mt-0.5">{suggestion.description}</div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 text-sm shrink-0"
        >
          Skip
        </button>
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium"
        >
          Add task
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
          <input
            type="datetime-local"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={smsChecked}
                onChange={(e) => setSmsChecked(e.target.checked)}
              />
              SMS reminder
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailChecked}
                onChange={(e) => setEmailChecked(e.target.checked)}
              />
              Email reminder
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}
