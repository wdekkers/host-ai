'use client';

import type React from 'react';
import { useEffect, useState, useTransition } from 'react';

type NotificationChannel = 'sms' | 'email' | 'slack' | 'web';

type CategoryKey = 'escalation' | 'upsell' | 'task' | 'journey' | 'system';

type PreferenceRow = {
  category: string;
  channels: NotificationChannel[];
};

const CATEGORIES: { value: CategoryKey; label: string }[] = [
  { value: 'escalation', label: 'Escalation' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'task', label: 'Task' },
  { value: 'journey', label: 'Journey' },
  { value: 'system', label: 'System' },
];

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'web', label: 'Web' },
];

const DEFAULT_CHANNELS: NotificationChannel[] = ['web'];

type FormState = Record<CategoryKey, NotificationChannel[]>;

function buildDefaultForm(): FormState {
  return Object.fromEntries(
    CATEGORIES.map(({ value }) => [value, [...DEFAULT_CHANNELS]]),
  ) as FormState;
}

function buildFormFromPrefs(prefs: PreferenceRow[]): FormState {
  const form = buildDefaultForm();
  for (const pref of prefs) {
    const key = pref.category as CategoryKey;
    if (key in form) {
      form[key] = pref.channels;
    }
  }
  return form;
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400';

export function NotificationPreferencesClient(): React.ReactElement {
  const [form, setForm] = useState<FormState>(buildDefaultForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/notifications/preferences', { cache: 'no-store' });
        const data = (await res.json()) as PreferenceRow[] | { error?: string };

        if (!res.ok) {
          throw new Error(
            (data as { error?: string }).error ?? 'Unable to load notification preferences.',
          );
        }

        if (!isMounted) return;
        setForm(buildFormFromPrefs(data as PreferenceRow[]));
      } catch (error) {
        if (!isMounted) return;
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load notification preferences.',
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  function toggleChannel(category: CategoryKey, channel: NotificationChannel) {
    setForm((prev) => {
      const current = prev[category];
      const next = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...prev, [category]: next };
    });
    setSaveError(null);
    setSuccess(null);
  }

  function savePreferences() {
    setSaveError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const entries = CATEGORIES.map(({ value }) => ({ category: value, channels: form[value] }));

        const results = await Promise.all(
          entries.map((entry) =>
            fetch('/api/notifications/preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(entry),
            }),
          ),
        );

        const failed = results.find((r) => !r.ok);
        if (failed) {
          const payload = (await failed.json()) as { error?: string };
          throw new Error(payload.error ?? 'Unable to save preferences.');
        }

        setSuccess('Notification preferences saved.');
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : 'Unable to save notification preferences.',
        );
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading notification preferences…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Channels per Category
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Choose which channels you want to receive notifications on for each category.
          </p>
        </div>

        <div className="space-y-5">
          {CATEGORIES.map(({ value, label }) => (
            <div key={value}>
              <p className="mb-2 text-sm font-semibold text-gray-800">{label}</p>
              <div className="flex flex-wrap gap-6">
                {CHANNELS.map(({ value: channel, label: channelLabel }) => (
                  <label
                    key={channel}
                    className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      className={`${inputClass} h-4 w-4 cursor-pointer rounded border-gray-300 text-gray-900 focus:ring-gray-400`}
                      checked={form[value].includes(channel)}
                      onChange={() => toggleChannel(value, channel)}
                    />
                    {channelLabel}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(saveError ?? success) && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            saveError
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {saveError ?? success}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={savePreferences}
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
