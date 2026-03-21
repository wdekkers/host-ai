'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

type Fact = { text: string; type: 'property_fact' | 'situational' | string };

export function LearningToast({
  facts,
  propertyId,
  reservationId,
  onDismiss,
  onSaved,
}: {
  facts: Fact[];
  propertyId: string;
  reservationId: string;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const { getToken } = useAuth();
  const propertyFacts = facts.filter((f) => f.type === 'property_fact');
  const situational = facts.filter((f) => f.type !== 'property_fact');

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  async function saveAll() {
    setSaving(true);
    try {
      const token = await getToken();
      const responses = await Promise.all(
        propertyFacts.map((f) =>
          fetch(`/api/properties/${propertyId}/memory`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              fact: f.text,
              source: 'learned',
              sourceReservationId: reservationId,
            }),
          }),
        ),
      );
      const anyFailed = responses.some((r) => !r.ok);
      if (anyFailed) {
        console.error('Some memory saves failed');
      }
      onSaved();
    } catch {
      console.error('Failed to save memory facts');
    } finally {
      setSaving(false);
    }
  }

  async function saveSingle(text: string) {
    setSaving(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/properties/${propertyId}/memory`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fact: text, source: 'learned', sourceReservationId: reservationId }),
      });
      if (!response.ok) {
        console.error('Failed to save memory fact');
      }
      const newCount = savedCount + 1;
      setSavedCount(newCount);
      setEditingIdx(null);
      if (newCount >= propertyFacts.length) onSaved();
    } catch {
      console.error('Failed to save memory fact');
    } finally {
      setSaving(false);
    }
  }

  if (propertyFacts.length === 0) return null;

  return (
    <div
      className="mx-4 my-3 rounded-xl border border-slate-200 p-3 bg-sky-50"
      style={{ borderLeftColor: '#0284c7', borderLeftWidth: '3px' }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">🧠</span>
        <span className="text-xs font-semibold text-sky-700">
          I picked up something — save to this property?
        </span>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        {propertyFacts.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2.5 py-2 bg-white border border-slate-200"
          >
            <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 bg-sky-100 text-sky-700">
              Property fact
            </span>
            {editingIdx === i ? (
              <div className="flex-1 flex gap-1.5">
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 rounded border border-sky-400 bg-white text-slate-800 outline-none"
                />
                <button
                  onClick={() => void saveSingle(editText)}
                  disabled={saving}
                  className="text-xs px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingIdx(null)}
                  className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex-1 flex justify-between items-start gap-2">
                <span className="text-xs leading-relaxed text-slate-700">{f.text}</span>
                <button
                  onClick={() => {
                    setEditingIdx(i);
                    setEditText(f.text);
                  }}
                  className="text-xs flex-shrink-0 text-slate-400 hover:text-slate-600"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}

        {situational.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2.5 py-2 opacity-50 bg-white border border-slate-200"
          >
            <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 bg-slate-100 text-slate-500">
              One-off
            </span>
            <span className="text-xs text-slate-500">{f.text}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void saveAll()}
          disabled={saving}
          className="flex-1 text-xs py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700"
        >
          {saving ? 'Saving…' : '✓ Save to Memory'}
        </button>
        {propertyFacts.length > 0 && editingIdx === null && (
          <button
            onClick={() => {
              setEditingIdx(0);
              setEditText(propertyFacts[0]!.text);
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            Edit first
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-xs px-2 py-1.5 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
