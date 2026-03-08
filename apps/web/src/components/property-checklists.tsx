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

export function PropertyChecklists() {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completedItemIds, setCompletedItemIds] = useState<string[]>([]);
  const [question, setQuestion] = useState('Inspect pool chemistry and record values');
  const [answer, setAnswer] = useState('Target chlorine 1-3 ppm, pH 7.2-7.8, and attach photo evidence.');
  const [error, setError] = useState<string | null>(null);

  const loadProperties = async () => {
    const res = await fetch('/api/properties');
    if (!res.ok) {
      setError('Unable to load properties.');
      return;
    }
    const payload = (await res.json()) as { items: PropertyItem[] };
    const list = payload.items ?? [];
    setProperties(list);
    if (!selectedPropertyId && (list.length ?? 0) > 0) {
      setSelectedPropertyId(list[0]!.id);
    }
    setError(null);
  };

  const loadChecklist = async (propertyId: string) => {
    if (!propertyId) return;
    const res = await fetch(`/api/command-center/qa/${encodeURIComponent(propertyId)}?status=active`);
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
    const res = await fetch(`/api/property-checklists/executions?propertyId=${encodeURIComponent(propertyId)}`);
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
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() })
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
    const res = await fetch('/api/property-checklists/executions', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: selectedPropertyId, completedItemIds })
    });
    if (!res.ok) {
      setError('Unable to save checklist execution.');
      return;
    }
    setError(null);
  };

  useEffect(() => {
    void loadProperties();
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) return;
    void Promise.all([loadChecklist(selectedPropertyId), loadExecution(selectedPropertyId)]);
  }, [selectedPropertyId]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Property Checklists</h1>
        <p className="text-sm text-gray-500 mt-1">Create checklist items per property and execute them as operational runs.</p>
      </div>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Property Scope</h2>
        <div className="flex gap-2 items-center">
          <select className="border rounded px-2 py-1 min-w-80" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <button className="border rounded px-3 py-1" onClick={() => void Promise.all([loadChecklist(selectedPropertyId), loadExecution(selectedPropertyId)])}>
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Add Checklist Item</h2>
        <div className="grid gap-2">
          <input className="border rounded px-2 py-1" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Checklist step" />
          <textarea className="border rounded px-2 py-1" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={2} placeholder="Execution guidance" />
          <button className="border rounded px-3 py-1 w-fit" onClick={() => void addChecklistItem()}>
            Add Item
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Execute Checklist</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No checklist items for this property.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item) => {
              const checked = completedItemIds.includes(item.id);
              return (
                <li key={item.id} className="rounded border p-2">
                  <label className="flex gap-2 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...completedItemIds, item.id]
                          : completedItemIds.filter((id) => id !== item.id);
                        setCompletedItemIds(Array.from(new Set(next)));
                      }}
                    />
                    <span>
                      <strong>{item.question}</strong>
                      <br />
                      <span className="text-gray-600">{item.answer}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <button className="border rounded px-3 py-1" onClick={() => void saveExecution()}>
          Save Checklist Run
        </button>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
