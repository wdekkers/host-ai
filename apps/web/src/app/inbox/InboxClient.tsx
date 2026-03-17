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
    <div className="flex h-screen overflow-hidden" style={{ background: '#071428' }}>
      {/* Left column — use visibility/positioning (NOT display:none) to preserve scroll position on mobile */}
      <div
        className={`flex-shrink-0 border-r overflow-hidden flex w-full md:w-[30%] ${
          showThread
            ? 'absolute inset-0 opacity-0 pointer-events-none md:relative md:opacity-100 md:pointer-events-auto'
            : ''
        }`}
        style={{ borderColor: '#1a3a5c' }}
      >
        <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Right column — hidden on mobile when no thread selected */}
      <div className={`flex-1 overflow-hidden ${!showThread ? 'hidden md:flex' : 'flex'} flex-col`}>
        {selectedId ? (
          <ConversationThread reservationId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: '#334155' }}>
            <p className="text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
