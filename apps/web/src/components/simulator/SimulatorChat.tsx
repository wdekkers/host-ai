'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Trash2, Settings2 } from 'lucide-react';

interface ChatMessage {
  role: 'guest' | 'agent';
  content: string;
}

interface SimulatorChatProps {
  propertyId: string;
}

export function SimulatorChat({ propertyId }: SimulatorChatProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [guestName, setGuestName] = useState('Test Guest');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const newMessage: ChatMessage = { role: 'guest', content: input.trim() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const token = await getToken();
      const res = await fetch('/api/simulator/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          messages: updatedMessages,
          guestName,
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages([...updatedMessages, { role: 'agent', content: data.reply }]);
      } else {
        setMessages([
          ...updatedMessages,
          { role: 'agent', content: '(Error: failed to generate reply)' },
        ]);
      }
    } catch {
      setMessages([
        ...updatedMessages,
        { role: 'agent', content: '(Error: request failed)' },
      ]);
    }

    setLoading(false);
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Config toggle */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showConfig ? 'Hide' : 'Guest'} context
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Fake reservation config */}
      {showConfig && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Guest name"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            placeholder="Check-in"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            placeholder="Check-out"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      )}

      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-3 h-80 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8">
              Type a message as a guest to test the AI agent.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'guest' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'guest'
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input */}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a guest message..."
          disabled={loading}
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={!input.trim() || loading}
          className="bg-sky-600 hover:bg-sky-700 text-white"
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
