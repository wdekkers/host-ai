'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, Send, HardHat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Vendor = {
  id: string;
  companyName: string;
  contactName: string;
  phoneE164: string;
  status: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
  deliveryStatus: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function VendorHub() {
  const { getToken } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const loadVendors = useCallback(async () => {
    const res = await fetch('/api/vendor-hub', { headers: await authHeader() });
    if (res.ok) {
      const data = (await res.json()) as { vendors: Vendor[] };
      setVendors(data.vendors);
    }
    setLoading(false);
  }, [authHeader]);

  const loadMessages = useCallback(async (vendorId: string) => {
    setLoadingMessages(true);
    const res = await fetch(`/api/vendor-hub/${vendorId}/messages`, {
      headers: await authHeader(),
    });
    if (res.ok) {
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages);
    }
    setLoadingMessages(false);
  }, [authHeader]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  // Scroll to bottom after messages render
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [loadingMessages, messages]);

  const selectedVendor = vendors.find((v) => v.id === selectedId);
  const showThread = selectedId !== null;

  const filtered = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.contactName.toLowerCase().includes(q) ||
      v.companyName.toLowerCase().includes(q) ||
      v.phoneE164.includes(q)
    );
  });

  return (
    <div className="h-full overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] bg-white">
      {/* Left — vendor list */}
      <div
        className={`border-r border-slate-200 overflow-hidden flex flex-col ${showThread ? 'hidden md:flex' : 'flex'}`}
      >
        {/* Search */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Vendor list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-center text-slate-400">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-center text-slate-400">No vendors found.</p>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  v.id === selectedId ? 'bg-sky-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                    {initials(v.contactName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {v.contactName}
                      </span>
                      {v.lastMessageAt && (
                        <span className="text-xs text-slate-400 shrink-0">
                          {formatTime(v.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{v.companyName}</p>
                    {v.lastMessageBody && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {v.lastMessageBody}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — conversation */}
      <div
        className={`overflow-hidden flex flex-col bg-slate-50 ${showThread ? 'flex' : 'hidden md:flex'}`}
      >
        {selectedVendor ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white shrink-0">
              <button
                onClick={() => setSelectedId(null)}
                className="md:hidden text-sm mr-1 text-slate-400"
              >
                ←
              </button>
              <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {initials(selectedVendor.contactName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{selectedVendor.contactName}</p>
                <p className="text-xs text-slate-500 truncate">
                  {selectedVendor.companyName} · {selectedVendor.phoneE164}
                </p>
              </div>
              <Badge variant={selectedVendor.status === 'active' ? 'default' : 'secondary'}>
                {selectedVendor.status}
              </Badge>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {loadingMessages ? (
                <p className="text-xs text-center text-slate-400">Loading...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-center text-slate-400">No messages yet.</p>
              ) : (
                messages.map((m) => {
                  const isOutbound = m.direction === 'outbound';
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2 max-w-[75%] ${isOutbound ? 'self-end flex-row-reverse' : ''}`}
                    >
                      <div className="flex flex-col gap-1">
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
              <div ref={messagesEndRef} />
            </div>

            {/* Composer placeholder */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Message ${selectedVendor.contactName}...`}
                  disabled
                  className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                />
                <Button size="icon" disabled className="h-8 w-8">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">SMS sending requires Twilio integration</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <HardHat className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Select a vendor to view the conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
