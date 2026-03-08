'use client';

import { useEffect, useMemo, useState } from 'react';

type Contact = {
  id: string;
  displayName: string;
  contactType: string;
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
  preferred: boolean;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
};

const contactTypeSuggestions = ['pool-maintenance', 'plumber', 'handyman', 'cleaner', 'electrician'];

export function ContactCenter() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactType, setContactType] = useState('');
  const [contactChannel, setContactChannel] = useState<Contact['channel']>('sms');
  const [contactHandle, setContactHandle] = useState('');

  const [composerBody, setComposerBody] = useState('');
  const [composerDirection, setComposerDirection] = useState<'inbound' | 'outbound'>('outbound');

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const resolvedTypeSuggestions = useMemo(() => {
    const dynamic = contacts.map((contact) => contact.contactType.trim()).filter((value) => value.length > 0);
    return Array.from(new Set([...contactTypeSuggestions, ...dynamic])).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const loadContacts = async () => {
    const res = await fetch('/api/messaging/contacts');
    if (!res.ok) {
      setError('Unable to load contacts.');
      return;
    }
    const data = (await res.json()) as { items: Contact[] };
    const sorted = data.items ?? [];
    setContacts(sorted);

    const preferred = sorted.find((contact) => contact.preferred);
    const nextId = preferred?.id ?? sorted[0]?.id ?? '';
    if (nextId && !sorted.some((c) => c.id === selectedContactId)) {
      setSelectedContactId(nextId);
    }
    setError(null);
  };

  const loadMessages = async (contactId: string) => {
    if (!contactId) return;
    const res = await fetch(`/api/messaging/messages?contactId=${encodeURIComponent(contactId)}`);
    if (!res.ok) {
      setError('Unable to load conversation.');
      return;
    }
    const data = (await res.json()) as { items: Message[] };
    setMessages(data.items ?? []);
    setError(null);
  };

  const addContact = async () => {
    if (!contactName.trim() || !contactHandle.trim() || !contactType.trim()) {
      setError('Contact name, type, and contact details are required.');
      return;
    }

    const res = await fetch('/api/messaging/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: contactName.trim(),
        contactType: contactType.trim(),
        channel: contactChannel,
        handle: contactHandle.trim()
      })
    });

    if (!res.ok) {
      setError('Unable to add contact.');
      return;
    }

    const payload = (await res.json()) as { item: Contact };
    setContactName('');
    setContactHandle('');
    await loadContacts();
    setSelectedContactId(payload.item.id);
    setError(null);
  };

  const setPreferredContact = async (id: string) => {
    const res = await fetch(`/api/messaging/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferred: true })
    });

    if (!res.ok) {
      setError('Unable to update preferred contact.');
      return;
    }

    await loadContacts();
    setSelectedContactId(id);
    setError(null);
  };

  const sendMessage = async () => {
    if (!selectedContactId || !composerBody.trim()) {
      setError('Select a contact and enter a message.');
      return;
    }

    const res = await fetch('/api/messaging/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contactId: selectedContactId,
        direction: composerDirection,
        body: composerBody.trim()
      })
    });

    if (!res.ok) {
      setError('Unable to send message.');
      return;
    }

    setComposerBody('');
    await Promise.all([loadMessages(selectedContactId), loadContacts()]);
    setError(null);
  };

  useEffect(() => {
    void loadContacts();
  }, []);

  useEffect(() => {
    void loadMessages(selectedContactId);
  }, [selectedContactId]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="text-sm text-gray-500 mt-1">Manage contacts and run conversations directly in the portal.</p>
      </div>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Add Contact</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <input
            className="border rounded px-2 py-1"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Contact name"
          />
          <div>
            <input
              list="contact-type-options"
              className="border rounded px-2 py-1 w-full"
              value={contactType}
              onChange={(event) => setContactType(event.target.value)}
              placeholder="Contact type"
            />
            <datalist id="contact-type-options">
              {resolvedTypeSuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <select className="border rounded px-2 py-1" value={contactChannel} onChange={(event) => setContactChannel(event.target.value as Contact['channel'])}>
            <option value="sms">sms</option>
            <option value="email">email</option>
            <option value="airbnb">airbnb</option>
          </select>
          <input
            className="border rounded px-2 py-1"
            value={contactHandle}
            onChange={(event) => setContactHandle(event.target.value)}
            placeholder="Phone or email"
          />
          <button className="border rounded px-3 py-1" onClick={() => void addContact()}>
            Add Contact
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Contacts</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500">No contacts yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contacts.map((contact) => (
              <li key={contact.id} className="rounded border p-2 flex items-center justify-between gap-3">
                <div>
                  <button className="font-medium text-left" onClick={() => setSelectedContactId(contact.id)}>
                    {contact.displayName}
                  </button>{' '}
                  ({contact.contactType}) - {contact.handle}
                </div>
                <label className="flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={contact.preferred}
                    onChange={() => void setPreferredContact(contact.id)}
                  />
                  preferred
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Conversation</h2>
        {selectedContact ? (
          <p className="text-sm text-gray-600">
            Active contact: <strong>{selectedContact.displayName}</strong> ({selectedContact.contactType}) via {selectedContact.channel}
          </p>
        ) : (
          <p className="text-sm text-gray-500">No contact selected yet.</p>
        )}

        <div className="grid gap-2">
          <div className="flex gap-2">
            <select
              className="border rounded px-2 py-1"
              value={composerDirection}
              onChange={(event) => setComposerDirection(event.target.value as 'inbound' | 'outbound')}
            >
              <option value="outbound">outbound</option>
              <option value="inbound">inbound</option>
            </select>
            <button className="border rounded px-3 py-1" onClick={() => void sendMessage()}>
              Send Message
            </button>
          </div>
          <textarea
            className="border rounded px-2 py-1"
            value={composerBody}
            onChange={(event) => setComposerBody(event.target.value)}
            rows={2}
            placeholder="Type message"
          />
        </div>

        <ul className="space-y-2 text-sm">
          {messages.map((message) => (
            <li key={message.id} className="rounded border p-2">
              <span className="font-medium">[{message.direction}]</span> {message.body}
              <span className="text-gray-400 text-xs ml-2">{new Date(message.sentAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
