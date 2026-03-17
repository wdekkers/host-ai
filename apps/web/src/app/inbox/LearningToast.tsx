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
      className="mx-4 my-3 rounded-xl border p-3"
      style={{
        background: '#0a1e38',
        borderColor: '#1e3a5f',
        borderLeftColor: '#3b82f6',
        borderLeftWidth: '3px',
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">🧠</span>
        <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
          I picked up something — save to this property?
        </span>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        {propertyFacts.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2.5 py-2"
            style={{ background: '#071428', border: '1px solid #1a3a5c' }}
          >
            <span
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
              style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '9px' }}
            >
              Property fact
            </span>
            {editingIdx === i ? (
              <div className="flex-1 flex gap-1.5">
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 rounded border outline-none"
                  style={{ background: '#0d1f38', borderColor: '#3b82f6', color: '#e2e8f0' }}
                />
                <button
                  onClick={() => void saveSingle(editText)}
                  disabled={saving}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: '#14532d', color: '#4ade80' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingIdx(null)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: '#1a1a2e', color: '#64748b' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex-1 flex justify-between items-start gap-2">
                <span className="text-xs leading-relaxed" style={{ color: '#e2e8f0' }}>
                  {f.text}
                </span>
                <button
                  onClick={() => {
                    setEditingIdx(i);
                    setEditText(f.text);
                  }}
                  className="text-xs flex-shrink-0"
                  style={{ color: '#475569' }}
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
            className="flex items-start gap-2 rounded-lg px-2.5 py-2 opacity-40"
            style={{ background: '#071428', border: '1px solid #1a3a5c' }}
          >
            <span
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
              style={{ background: '#1a1a2e', color: '#64748b', fontSize: '9px' }}
            >
              One-off
            </span>
            <span className="text-xs" style={{ color: '#94a3b8' }}>
              {f.text}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void saveAll()}
          disabled={saving}
          className="flex-1 text-xs py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          {saving ? 'Saving…' : '✓ Save to Memory'}
        </button>
        {propertyFacts.length > 0 && editingIdx === null && (
          <button
            onClick={() => {
              setEditingIdx(0);
              setEditText(propertyFacts[0]!.text);
            }}
            className="text-xs px-3 py-1.5 rounded-md border"
            style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#94a3b8' }}
          >
            Edit first
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-xs px-2 py-1.5 rounded-md border"
          style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#475569' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
