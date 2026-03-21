'use client';

import { useState } from 'react';
import { ConversationList } from './ConversationList';
import { ConversationThread } from './ConversationThread';

export type InboxThread = {
  reservationId: string;
  guestName: string;
  propertyId: string | null;
  propertyName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
  lastBody: string;
  lastSenderType: string;
  lastMessageAt: string;
  unreplied: boolean;
  aiReady: boolean;
  latestMessageId: string | null;
  latestSuggestion: string | null;
};

export function InboxClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // mobile: show thread when selectedId is set
  const showThread = selectedId !== null;

  return (
    <div className="h-screen overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] bg-white">
      {/* Left column — hidden on mobile when thread is open */}
      <div
        className={`border-r border-slate-200 overflow-hidden flex flex-col ${showThread ? 'hidden md:flex' : 'flex'}`}
        style={{ minWidth: 0 }}
      >
        <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Right column — hidden on mobile when no thread is open */}
      <div
        className={`overflow-hidden flex flex-col bg-slate-50 ${showThread ? 'flex' : 'hidden md:flex'}`}
        style={{ minWidth: 0 }}
      >
        {selectedId ? (
          <ConversationThread reservationId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
