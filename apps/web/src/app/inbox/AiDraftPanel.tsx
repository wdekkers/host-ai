'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertTriangle, BookOpen, Lightbulb, Building } from 'lucide-react';
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
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [manualReply, setManualReply] = useState('');
  const [pendingFacts, setPendingFacts] = useState<Array<{ text: string; type: string }>>([]);
  const [sourcesUsed, setSourcesUsed] = useState<Array<{ type: string; id: string; label: string; snippet?: string }>>([]);
  const [escalationLevel, setEscalationLevel] = useState<string | null>(null);
  const [escalationReason, setEscalationReason] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);

  // Reset state whenever the unreplied message changes (including when it becomes null after a reply is sent)
  useEffect(() => {
    setDismissed(false);
    setSuggestion(null);
    setSkipReason(null);
    setActiveChips([]);
    setExtraContext('');
    if (unrepliedMessage) {
      void generate(unrepliedMessage.id, [], '');
    }
  }, [unrepliedMessage?.id]); // intentionally omit generate — it's defined inline and stable

  // The message id to use for AI generation (null when no guest message exists — generate from context only)
  const generateMessageId = (unrepliedMessage ?? latestGuestMessage)?.id ?? null;
  // Always show the AI draft section unless explicitly dismissed
  const showDraftSection = !dismissed;

  async function generate(messageId: string | null, chips: string[], context: string) {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/inbox/${reservationId}/suggest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messageId: messageId ?? undefined, chips, extraContext: context || undefined }),
      });
      const data = (await res.json()) as {
        action?: 'draft' | 'skip';
        suggestion?: string;
        reason?: string;
        sourcesUsed?: Array<{ type: string; id: string; label: string; snippet?: string }>;
        escalationLevel?: string;
        escalationReason?: string;
      };
      if (data.action === 'skip' && data.reason) {
        setSkipReason(data.reason);
        setSuggestion(null);
        setSourcesUsed(data.sourcesUsed ?? []);
        setEscalationLevel(data.escalationLevel ?? null);
        setEscalationReason(data.escalationReason ?? null);
        setDraftStatus(null);
      } else if (data.suggestion) {
        setSuggestion(data.suggestion);
        setSkipReason(null);
        setSourcesUsed(data.sourcesUsed ?? []);
        setEscalationLevel(data.escalationLevel ?? null);
        setEscalationReason(data.escalationReason ?? null);
        setDraftStatus('pending_review');
      }
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
        body: JSON.stringify({
          suggestion: body,
          messageId: unrepliedMessage?.id ?? latestGuestMessage?.id,
        }),
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
      setActiveChips([]);
      setExtraContext('');
      setManualReply('');
      setSourcesUsed([]);
      setEscalationLevel(null);
      setEscalationReason(null);
      setDraftStatus(null);
      onSent();
    } finally {
      setSending(false);
    }
  }

  async function handleReject() {
    const messageId = unrepliedMessage?.id ?? latestGuestMessage?.id;
    if (!messageId) return;
    const token = await getToken();
    await fetch(`/api/inbox/${reservationId}/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messageId }),
    });
    setDismissed(true);
    setSuggestion(null);
    setDraftStatus('rejected');
  }

  // Do NOT return null when unrepliedMessage is absent — the manual reply bar must always be visible (spec §3.3)

  return (
    <div className="flex-shrink-0 border-t border-slate-200 bg-white">
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

      {/* Draft section — always available for AI generation */}
      {showDraftSection && (
        <div className="px-4 py-3 border-b border-slate-200 max-h-[50vh] overflow-y-auto">
          {/* Escalation banner */}
          {escalationLevel === 'escalate' && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 mb-2 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">Requires manual review</span>
                {escalationReason && <span className="text-red-600"> — {escalationReason}</span>}
              </div>
            </div>
          )}
          {escalationLevel === 'caution' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 mb-2 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">Review carefully</span>
                {escalationReason && <span className="text-amber-600"> — {escalationReason}</span>}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sky-600 text-xs">✦</span>
              <span className="text-xs font-semibold text-sky-700">AI Draft</span>
              {loading && <span className="text-xs text-slate-400">· generating…</span>}
              {draftStatus && !loading && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  draftStatus === 'pending_review' ? 'bg-sky-100 text-sky-700' :
                  draftStatus === 'sent' ? 'bg-green-100 text-green-700' :
                  draftStatus === 'rejected' ? 'bg-slate-100 text-slate-500' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {draftStatus === 'pending_review' ? 'Pending' :
                   draftStatus === 'sent' ? 'Sent' :
                   draftStatus === 'rejected' ? 'Dismissed' : draftStatus}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {suggestion && !loading && (
                <button
                  onClick={() => void handleSend(suggestion)}
                  disabled={sending}
                  className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700"
                >
                  {sending ? 'Sending…' : '✓ Approve & Send'}
                </button>
              )}
              {suggestion && !loading && (
                <button
                  onClick={() => void generate(generateMessageId, activeChips, extraContext)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  ↺
                </button>
              )}
              <button
                onClick={() => void handleReject()}
                className="text-xs px-2 py-1.5 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>
          </div>

          {/* No reply recommended (AI-driven skip) */}
          {skipReason && !suggestion && !loading && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="font-semibold mb-0.5">No reply recommended</div>
              <div className="text-amber-700">{skipReason}</div>
              <button
                onClick={() => {
                  setSkipReason(null);
                }}
                className="mt-1.5 text-[11px] underline text-amber-700 hover:text-amber-900"
              >
                Draft anyway
              </button>
            </div>
          )}

          {/* No active draft: show context input to describe what to compose */}
          {!suggestion && !skipReason && !loading && (
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
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-500 mb-2"
                autoFocus
              />
              <button
                onClick={() => void generate(generateMessageId, activeChips, extraContext)}
                disabled={!extraContext.trim()}
                className="text-xs px-3 py-1.5 rounded-md disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 transition-colors"
              >
                ✦ Generate
              </button>
            </div>
          )}

          {suggestion && !loading && (
            <>
              {/* Draft text */}
              <div className="text-xs leading-relaxed rounded-lg px-3 py-2.5 mb-2.5 bg-slate-50 border border-slate-200 text-slate-700">
                {suggestion}
              </div>

              {/* Sources used */}
              {sourcesUsed.length > 0 && (
                <details className="mb-2.5 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-medium text-slate-500">
                    Context used ({sourcesUsed.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {sourcesUsed.map((source, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-500">
                        {source.type === 'knowledge_entry' && <BookOpen className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                        {source.type === 'property_memory' && <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                        {source.type === 'property_field' && <Building className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                        <span>{source.label}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CHIPS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => toggleChip(c.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeChips.includes(c.key)
                        ? 'bg-sky-50 border-sky-400 text-sky-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
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
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-500"
              />
              {(activeChips.length > 0 || extraContext.trim()) && (
                <button
                  onClick={() => void generate(generateMessageId, activeChips, extraContext)}
                  className="mt-2 text-xs px-3 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
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
        {/* Reopen AI panel when dismissed */}
        {dismissed && (
          <button
            onClick={() => {
              setDismissed(false);
              setSuggestion(null);
              setActiveChips([]);
              setExtraContext('');
            }}
            className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-sky-600 flex-shrink-0 hover:bg-sky-50 transition-colors"
            title="Reopen AI Draft"
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
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-500"
        />
        <button
          onClick={() => void handleSend(manualReply)}
          disabled={!manualReply.trim() || sending}
          className="text-xs px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
