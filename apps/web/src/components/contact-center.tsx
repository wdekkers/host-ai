'use client';

import { useEffect, useState } from 'react';

type Contact = {
  id: string;
  displayName: string;
  channel: 'sms' | 'airbnb' | 'email';
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
};

type ChecklistItem = {
  id: string;
  question: string;
  answer: string;
  status: 'active' | 'archived';
};

export function ContactCenter() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [propertyId, setPropertyId] = useState('property:res-demo-001');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [question, setQuestion] = useState('What is the Wi-Fi network and password?');
  const [answer, setAnswer] = useState('Network: StayFrisco-Guest, Password: frisco2026!');

  const loadContacts = async () => {
    const res = await fetch('/api/messaging/contacts');
    if (!res.ok) return;
    const data = (await res.json()) as { items: Contact[] };
    setContacts(data.items ?? []);
    if (!selectedContactId && (data.items?.length ?? 0) > 0) {
      setSelectedContactId(data.items[0]!.id);
    }
  };

  const loadMessages = async (contactId: string) => {
    if (!contactId) return;
    const res = await fetch(`/api/messaging/messages?contactId=${encodeURIComponent(contactId)}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: Message[] };
    setMessages(data.items ?? []);
  };

  const loadChecklist = async () => {
    const res = await fetch(`/api/command-center/qa/${encodeURIComponent(propertyId)}?status=active`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: ChecklistItem[] };
    setItems(data.items ?? []);
  };

  const addChecklistItem = async () => {
    const res = await fetch(`/api/command-center/qa/${encodeURIComponent(propertyId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, answer }),
    });
    if (!res.ok) return;
    await loadChecklist();
  };

  useEffect(() => {
    void loadContacts();
    void loadChecklist();
  }, []);

  useEffect(() => {
    void loadMessages(selectedContactId);
  }, [selectedContactId]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Contact Center</h1>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Contacts and Messages</h2>
        <div className="flex gap-2 items-center">
          <select
            className="border rounded px-2 py-1"
            value={selectedContactId}
            onChange={(event) => setSelectedContactId(event.target.value)}
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.displayName} ({contact.channel})
              </option>
            ))}
          </select>
          <button className="border rounded px-3 py-1" onClick={() => void loadMessages(selectedContactId)}>
            Refresh
          </button>
        </div>
        <ul className="list-disc pl-5 text-sm space-y-1">
          {messages.map((message) => (
            <li key={message.id}>
              [{message.direction}] {message.body}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Property Checklist</h2>
        <input
          className="border rounded px-2 py-1 w-full"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          placeholder="property id"
        />
        <div className="grid gap-2">
          <input
            className="border rounded px-2 py-1"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Checklist question"
          />
          <textarea
            className="border rounded px-2 py-1"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={2}
            placeholder="Checklist answer"
          />
          <div className="flex gap-2">
            <button className="border rounded px-3 py-1" onClick={() => void addChecklistItem()}>
              Add Item
            </button>
            <button className="border rounded px-3 py-1" onClick={() => void loadChecklist()}>
              Refresh
            </button>
          </div>
        </div>
        <ul className="list-disc pl-5 text-sm space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <strong>Q:</strong> {item.question} <strong>A:</strong> {item.answer} ({item.status})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
