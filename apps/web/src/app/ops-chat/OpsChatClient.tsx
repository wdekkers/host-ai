'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, Send, MessagesSquare, Users, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Card/CardContent available if needed for future UI

type Participant = {
  id: string;
  threadId: string;
  displayName: string;
  phoneE164: string;
};

type Thread = {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  participantCount: number;
  participants: Participant[];
};

type Message = {
  id: string;
  threadId: string;
  senderName: string | null;
  senderPhone: string | null;
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function OpsChatClient() {
  const { getToken } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composerBody, setComposerBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadType, setNewThreadType] = useState<'direct' | 'group'>('direct');
  const [newThreadName, setNewThreadName] = useState('');
  const [newParticipants, setNewParticipants] = useState<{ displayName: string; phoneE164: string }[]>([{ displayName: '', phoneE164: '' }]);
  const [creating, setCreating] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef(false);

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  // Scroll after render
  useEffect(() => {
    if (!loadingMessages && shouldScrollToBottom.current) {
      shouldScrollToBottom.current = false;
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [loadingMessages, messages]);

  const loadThreads = useCallback(async () => {
    const res = await fetch('/api/ops-chat', { headers: await authHeader() });
    if (res.ok) {
      const data = (await res.json()) as { threads: Thread[] };
      setThreads(data.threads);
    }
    setLoading(false);
  }, [authHeader]);

  const loadMessages = useCallback(async (threadId: string) => {
    setLoadingMessages(true);
    const res = await fetch(`/api/ops-chat/${threadId}/messages`, {
      headers: await authHeader(),
    });
    if (res.ok) {
      const data = (await res.json()) as { messages: Message[] };
      shouldScrollToBottom.current = true;
      setMessages(data.messages);
    }
    setLoadingMessages(false);
  }, [authHeader]);

  const sendMessage = async () => {
    if (!selectedId || !composerBody.trim()) return;
    setSending(true);
    const res = await fetch(`/api/ops-chat/${selectedId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...await authHeader() },
      body: JSON.stringify({ body: composerBody.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setComposerBody('');
      shouldScrollToBottom.current = true;
      await loadMessages(selectedId);
      await loadThreads();
    }
  };

  const createThread = async () => {
    const validParticipants = newParticipants.filter((p) => p.displayName.trim() && p.phoneE164.trim());
    if (validParticipants.length === 0) return;
    setCreating(true);
    const res = await fetch('/api/ops-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...await authHeader() },
      body: JSON.stringify({
        type: newThreadType,
        name: newThreadType === 'group' ? newThreadName.trim() || undefined : undefined,
        participants: validParticipants,
      }),
    });
    setCreating(false);
    if (res.ok) {
      const data = (await res.json()) as { threadId: string };
      setShowNewThread(false);
      setNewThreadName('');
      setNewParticipants([{ displayName: '', phoneE164: '' }]);
      setNewThreadType('direct');
      await loadThreads();
      setSelectedId(data.threadId);
    }
  };

  const addParticipantRow = () => {
    setNewParticipants((prev) => [...prev, { displayName: '', phoneE164: '' }]);
  };

  const updateParticipant = (idx: number, field: 'displayName' | 'phoneE164', value: string) => {
    setNewParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removeParticipant = (idx: number) => {
    setNewParticipants((prev) => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => { void loadThreads(); }, [loadThreads]);
  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  const selectedThread = threads.find((t) => t.id === selectedId);
  const showThread = selectedId !== null;

  const filtered = threads.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = t.name ?? t.participants.map((p) => p.displayName).join(', ');
    return name.toLowerCase().includes(q);
  });

  return (
    <div className="h-full overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] bg-white">
      {/* Left — thread list */}
      <div className={`border-r border-slate-200 overflow-hidden flex flex-col ${showThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-slate-200 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              placeholder="Search threads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowNewThread(!showNewThread)}>
            {showNewThread ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {/* New thread form */}
        {showNewThread && (
          <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setNewThreadType('direct')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  newThreadType === 'direct' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Direct
              </button>
              <button
                onClick={() => setNewThreadType('group')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  newThreadType === 'group' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Group
              </button>
            </div>

            {newThreadType === 'group' && (
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Thread name..."
                value={newThreadName}
                onChange={(e) => setNewThreadName(e.target.value)}
              />
            )}

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Participants</div>
              {newParticipants.map((p, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <input
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Name"
                    value={p.displayName}
                    onChange={(e) => updateParticipant(idx, 'displayName', e.target.value)}
                  />
                  <input
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="+1 555 0100"
                    value={p.phoneE164}
                    onChange={(e) => updateParticipant(idx, 'phoneE164', e.target.value)}
                  />
                  {newParticipants.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-slate-400" onClick={() => removeParticipant(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {newThreadType === 'group' && (
                <button onClick={addParticipantRow} className="text-xs text-sky-600 hover:underline">
                  + Add participant
                </button>
              )}
            </div>

            <Button
              size="sm"
              className="w-full"
              disabled={creating || !newParticipants.some((p) => p.displayName.trim() && p.phoneE164.trim())}
              onClick={() => void createThread()}
            >
              {creating ? 'Creating...' : 'Start Conversation'}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-center text-slate-400">Loading...</p>
          ) : filtered.length === 0 && !showNewThread ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400 mb-2">No conversations yet.</p>
              <Button size="sm" variant="outline" onClick={() => setShowNewThread(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Start a conversation
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-center text-slate-400">No threads match your search.</p>
          ) : (
            filtered.map((t) => {
              const displayName = t.name ?? t.participants.map((p) => p.displayName).join(', ');
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    t.id === selectedId ? 'bg-sky-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      t.type === 'group' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {t.type === 'group' ? <Users className="h-3.5 w-3.5" /> : initials(displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{displayName}</span>
                        {t.lastMessageAt && (
                          <span className="text-xs text-slate-400 shrink-0">{formatTime(t.lastMessageAt)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {t.type === 'group' && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{t.participantCount}</Badge>
                        )}
                        {t.lastMessageBody && (
                          <p className="text-xs text-slate-400 truncate">{t.lastMessageBody}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right — conversation */}
      <div className={`overflow-hidden flex flex-col bg-slate-50 ${showThread ? 'flex' : 'hidden md:flex'}`}>
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white shrink-0">
              <button onClick={() => setSelectedId(null)} className="md:hidden text-sm mr-1 text-slate-400">←</button>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                selectedThread.type === 'group' ? 'bg-sky-600 text-white' : 'bg-sky-600 text-white'
              }`}>
                {selectedThread.type === 'group'
                  ? <Users className="h-3.5 w-3.5" />
                  : initials(selectedThread.name ?? selectedThread.participants[0]?.displayName ?? '?')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {selectedThread.name ?? selectedThread.participants.map((p) => p.displayName).join(', ')}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedThread.participants.map((p) => p.displayName).join(', ')}
                </p>
              </div>
              {selectedThread.type === 'group' && (
                <Badge variant="secondary">{selectedThread.participantCount} participants</Badge>
              )}
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {loadingMessages ? (
                <p className="text-xs text-center text-slate-400">Loading...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-center text-slate-400">No messages yet. Send the first message.</p>
              ) : (
                messages.map((m) => {
                  const isOutbound = m.direction === 'outbound';
                  return (
                    <div key={m.id} className={`flex gap-2 max-w-[75%] ${isOutbound ? 'self-end flex-row-reverse' : ''}`}>
                      <div className="flex flex-col gap-1">
                        {!isOutbound && m.senderName && (
                          <span className="text-[10px] text-slate-500 font-medium">{m.senderName}</span>
                        )}
                        <div
                          className={`px-3 py-2 text-xs leading-relaxed ${
                            isOutbound ? 'bg-sky-600 text-white' : 'bg-white text-slate-800'
                          }`}
                          style={{
                            borderRadius: isOutbound ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                            border: isOutbound ? 'none' : '1px solid #e2e8f0',
                          }}
                        >
                          {m.body}
                        </div>
                        <span className={`text-xs text-slate-400 ${isOutbound ? 'text-right' : ''}`}>
                          {formatTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                  className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <Button size="icon" className="h-8 w-8" disabled={sending || !composerBody.trim()} onClick={() => void sendMessage()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {selectedThread.type === 'group' && (
                <p className="text-xs text-slate-400 mt-1">
                  Message will be sent to {selectedThread.participantCount} participant{selectedThread.participantCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <MessagesSquare className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Select a thread or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
