'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { LearningToast } from './LearningToast';

type Message = { id: string; body: string };

const CHIPS = [
  { key: 'shorter', label: 'Shorter' },
  { key: 'no_emoji', label: 'No emoji' },
  { key: 'formal', label: 'More formal' },
  { key: 'friendly', label: 'More friendly' },
  { key: 'more_detail', label: '+ Add detail' },
];

export function AiDraftPanel({
  reservationId,
  propertyId,
  unrepliedMessage,
  latestGuestMessage,
  onSent,
}: {
  reservationId: string;
  propertyId: string | null;
  unrepliedMessage: Message | null;
  latestGuestMessage: Message | null;
  onSent: () => void;
}) {
  const { getToken } = useAuth();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [manualReply, setManualReply] = useState('');
  const [pendingFacts, setPendingFacts] = useState<Array<{ text: string; type: string }>>([]);

  // Auto-generate draft when a new unreplied message appears
  useEffect(() => {
    if (!unrepliedMessage) return;
    setDismissed(false);
    setAiAssistOpen(false);
    setSuggestion(null);
    setActiveChips([]);
    setExtraContext('');
    void generate(unrepliedMessage.id, [], '');
  }, [unrepliedMessage?.id]); // intentionally omit generate — it's defined inline and stable

  // The message id to use for AI generation
  const generateMessageId = (unrepliedMessage ?? latestGuestMessage)?.id ?? null;

  async function generate(messageId: string, chips: string[], context: string) {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/inbox/${reservationId}/suggest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messageId, chips, extraContext: context || undefined }),
      });
      const data = (await res.json()) as { suggestion?: string };
      if (data.suggestion) setSuggestion(data.suggestion);
    } finally {
      setLoading(false);
    }
  }

  function toggleChip(key: string) {
    setActiveChips((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  async function handleSend(body: string) {
    setSending(true);
    try {
      const token = await getToken();
      await fetch(`/api/inbox/${reservationId}/send`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ suggestion: body }),
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(body).catch(() => {});

      // Detect learnings async
      // Spec §5.1: fire detect if extraContext OR chips were used
      if ((extraContext.trim() || activeChips.length > 0) && propertyId) {
        void fetch(`/api/properties/${propertyId}/memory/detect`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ hintText: extraContext, chips: activeChips, reservationId }),
        })
          .then((r) => r.json() as Promise<{ facts: Array<{ text: string; type: string }> }>)
          .then((data) => {
            const propertyFacts = data.facts?.filter((f) => f.type === 'property_fact') ?? [];
            if (propertyFacts.length > 0) setPendingFacts(data.facts);
          });
      }

      setSuggestion(null);
      setDismissed(true);
      setManualReply('');
      onSent();
    } finally {
      setSending(false);
    }
  }

  // Do NOT return null when unrepliedMessage is absent — the manual reply bar must always be visible (spec §3.3)

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{ borderColor: '#1a3a5c', background: '#0a1e38' }}
    >
      {/* Learning toast */}
      {pendingFacts.length > 0 && propertyId && (
        <LearningToast
          facts={pendingFacts}
          propertyId={propertyId}
          reservationId={reservationId}
          onDismiss={() => setPendingFacts([])}
          onSaved={() => setPendingFacts([])}
        />
      )}

      {/* Draft section — auto-shown for unreplied messages, or manually opened via AI Assist */}
      {((unrepliedMessage && !dismissed) || aiAssistOpen) && generateMessageId && (
        <div className="px-4 py-3 border-b" style={{ borderColor: '#1a3a5c' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#60a5fa', fontSize: '12px' }}>✦</span>
              <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
                {unrepliedMessage && !dismissed ? 'AI Draft' : 'AI Assist'}
              </span>
              {loading && (
                <span className="text-xs" style={{ color: '#334155' }}>
                  · generating…
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {suggestion && !loading && (
                <button
                  onClick={() => void handleSend(suggestion)}
                  disabled={sending}
                  className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
                  style={{ background: '#14532d', color: '#4ade80' }}
                >
                  {sending ? 'Sending…' : '✓ Approve & Send'}
                </button>
              )}
              {suggestion && !loading && (
                <button
                  onClick={() => void generate(generateMessageId, activeChips, extraContext)}
                  className="text-xs px-2.5 py-1.5 rounded-md border transition-colors"
                  style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#94a3b8' }}
                >
                  ↺
                </button>
              )}
              <button
                onClick={() => {
                  setDismissed(true);
                  setAiAssistOpen(false);
                  setSuggestion(null);
                }}
                className="text-xs px-2 py-1.5 rounded-md border"
                style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#475569' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* AI Assist: show context input first if no suggestion yet and no unreplied message */}
          {aiAssistOpen && !unrepliedMessage && !suggestion && !loading && (
            <div className="mb-2">
              <input
                type="text"
                placeholder="What would you like to say? (e.g. check-in instructions, follow-up)…"
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && extraContext.trim()) {
                    void generate(generateMessageId, activeChips, extraContext);
                  }
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border outline-none mb-2"
                style={{ background: '#071428', borderColor: '#1a3a5c', color: '#94a3b8' }}
                autoFocus
              />
              <button
                onClick={() => void generate(generateMessageId, activeChips, extraContext)}
                disabled={!extraContext.trim()}
                className="text-xs px-3 py-1.5 rounded-md border disabled:opacity-50"
                style={{ background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff' }}
              >
                ✦ Generate
              </button>
            </div>
          )}

          {suggestion && !loading && (
            <>
              {/* Draft text */}
              <div
                className="text-xs leading-relaxed rounded-lg px-3 py-2.5 mb-2.5"
                style={{ background: '#071428', border: '1px solid #1a3a5c', color: '#cbd5e1' }}
              >
                {suggestion}
              </div>

              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CHIPS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => toggleChip(c.key)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                    style={{
                      background: activeChips.includes(c.key) ? '#1e3a5f' : '#0d1f38',
                      borderColor: activeChips.includes(c.key) ? '#3b82f6' : '#1a3a5c',
                      color: activeChips.includes(c.key) ? '#60a5fa' : '#64748b',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Extra context */}
              <input
                type="text"
                placeholder="Extra context for this reply (optional)…"
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (activeChips.length > 0 || extraContext.trim())) {
                    void generate(generateMessageId, activeChips, extraContext);
                  }
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
                style={{ background: '#071428', borderColor: '#1a3a5c', color: '#94a3b8' }}
              />
              {(activeChips.length > 0 || extraContext.trim()) && (
                <button
                  onClick={() => void generate(generateMessageId, activeChips, extraContext)}
                  className="mt-2 text-xs px-3 py-1.5 rounded-md border"
                  style={{ background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff' }}
                >
                  ↺ Regenerate with hints
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual reply */}
      <div className="px-4 py-3 flex gap-2 items-center">
        {/* AI Assist toggle — shown when draft section is closed and a guest message exists */}
        {!aiAssistOpen && (dismissed || !unrepliedMessage) && latestGuestMessage && (
          <button
            onClick={() => {
              setAiAssistOpen(true);
              setDismissed(false);
              setSuggestion(null);
              setActiveChips([]);
              setExtraContext('');
            }}
            className="text-xs px-2.5 py-2 rounded-lg border flex-shrink-0"
            style={{ background: '#0d1f38', borderColor: '#1a3a5c', color: '#60a5fa' }}
            title="Get AI help composing a message"
          >
            ✦
          </button>
        )}
        <input
          type="text"
          placeholder="Type a message…"
          value={manualReply}
          onChange={(e) => setManualReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manualReply.trim()) void handleSend(manualReply);
          }}
          className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
          style={{ background: '#071428', borderColor: '#1a3a5c', color: '#94a3b8' }}
        />
        <button
          onClick={() => void handleSend(manualReply)}
          disabled={!manualReply.trim() || sending}
          className="text-xs px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
