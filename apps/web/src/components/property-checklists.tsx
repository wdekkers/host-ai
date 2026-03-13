'use client';

import { useEffect, useState } from 'react';

type PropertyItem = { id: string; name: string };

type ChecklistItem = {
  id: string;
  propertyId: string;
  question: string;
  answer: string;
  status: 'active' | 'archived';
};

type Execution = {
  propertyId: string;
  completedItemIds: string[];
  updatedAt: string;
};

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400';

const btnPrimary =
  'rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 disabled:opacity-50 transition-colors';

const btnSecondary =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 transition-colors';

export function PropertyChecklists() {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completedItemIds, setCompletedItemIds] = useState<string[]>([]);
  const [question, setQuestion] = useState('Inspect pool chemistry and record values');
  const [answer, setAnswer] = useState(
    'Target chlorine 1-3 ppm, pH 7.2-7.8, and attach photo evidence.',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProperties = async () => {
    const res = await fetch('/api/properties');
    if (!res.ok) {
      setError('Unable to load properties.');
      return;
    }
    const payload = (await res.json()) as { items: PropertyItem[] };
    const list = payload.items ?? [];
    setProperties(list);
    if (!selectedPropertyId && list.length > 0) {
      setSelectedPropertyId(list[0]!.id);
    }
    setError(null);
  };

  const loadChecklist = async (propertyId: string) => {
    if (!propertyId) return;
    const res = await fetch(
      `/api/command-center/qa/${encodeURIComponent(propertyId)}?status=active`,
    );
    if (!res.ok) {
      setError('Unable to load checklist items.');
      return;
    }
    const payload = (await res.json()) as { items: ChecklistItem[] };
    setItems(payload.items ?? []);
    setError(null);
  };

  const loadExecution = async (propertyId: string) => {
    if (!propertyId) return;
    const res = await fetch(
      `/api/property-checklists/executions?propertyId=${encodeURIComponent(propertyId)}`,
    );
    if (!res.ok) {
      setError('Unable to load checklist execution state.');
      return;
    }
    const payload = (await res.json()) as { execution: Execution };
    setCompletedItemIds(payload.execution.completedItemIds ?? []);
    setError(null);
  };

  const addChecklistItem = async () => {
    if (!selectedPropertyId || !question.trim() || !answer.trim()) {
      setError('Property, question, and answer are required.');
      return;
    }
    const res = await fetch(`/api/command-center/qa/${encodeURIComponent(selectedPropertyId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
    });
    if (!res.ok) {
      setError('Unable to add checklist item.');
      return;
    }
    await loadChecklist(selectedPropertyId);
    setError(null);
  };

  const saveExecution = async () => {
    if (!selectedPropertyId) {
      setError('Select a property first.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/property-checklists/executions', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: selectedPropertyId, completedItemIds }),
    });
    setSaving(false);
    if (!res.ok) {
      setError('Unable to save checklist execution.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setError(null);
  };

  useEffect(() => {
    void loadProperties();
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) return;
    void Promise.all([loadChecklist(selectedPropertyId), loadExecution(selectedPropertyId)]);
  }, [selectedPropertyId]);

  const completedCount = completedItemIds.filter((id) => items.some((i) => i.id === id)).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Property Checklists</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create and execute operational checklists per property.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Property selector */}
      <div className="mb-6 flex items-center gap-3">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 min-w-64"
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
        <button
          className={btnSecondary}
          onClick={() =>
            void Promise.all([loadChecklist(selectedPropertyId), loadExecution(selectedPropertyId)])
          }
        >
          Refresh
        </button>
      </div>

      {/* Add item */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Add Checklist Item
        </h2>
        <div className="flex flex-col gap-3">
          <input
            className={inputClass}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Checklist step"
          />
          <textarea
            className={inputClass}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            placeholder="Execution guidance"
          />
          <div className="flex justify-end">
            <button className={btnPrimary} onClick={() => void addChecklistItem()}>
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Checklist execution */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Checklist Run
          </h2>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500">
              {completedCount}/{totalCount} completed
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="px-5 pt-3">
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-gray-900 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            No checklist items for this property.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const checked = completedItemIds.includes(item.id);
              return (
                <li key={item.id}>
                  <label
                    className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      checked ? 'opacity-60' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer"
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...completedItemIds, item.id]
                          : completedItemIds.filter((id) => id !== item.id);
                        setCompletedItemIds(Array.from(new Set(next)));
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          checked ? 'line-through text-gray-400' : 'text-gray-900'
                        }`}
                      >
                        {item.question}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">{item.answer}</p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {totalCount > 0 && progressPct === 100 ? '✓ All items completed' : ''}
          </span>
          <button
            className={saved ? `${btnPrimary} bg-green-700 hover:bg-green-700` : btnPrimary}
            disabled={saving}
            onClick={() => void saveExecution()}
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Run'}
          </button>
        </div>
      </div>
    </div>
  );
}
