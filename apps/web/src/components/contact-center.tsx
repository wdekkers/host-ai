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

const contactTypeSuggestions = [
  'pool-maintenance',
  'plumber',
  'handyman',
  'cleaner',
  'electrician',
];

const channelLabel: Record<Contact['channel'], string> = {
  sms: 'SMS',
  email: 'Email',
  airbnb: 'Airbnb',
};

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400';

const btnPrimary =
  'rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 disabled:opacity-50 transition-colors';


export function ContactCenter() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactType, setContactType] = useState('');
  const [contactChannel, setContactChannel] = useState<Contact['channel']>('sms');
  const [contactHandle, setContactHandle] = useState('');

  const [composerBody, setComposerBody] = useState('');
  const [composerDirection, setComposerDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [sending, setSending] = useState(false);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const resolvedTypeSuggestions = useMemo(() => {
    const dynamic = contacts
      .map((contact) => contact.contactType.trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set([...contactTypeSuggestions, ...dynamic])).sort((a, b) =>
      a.localeCompare(b),
    );
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
    setAdding(true);
    const res = await fetch('/api/messaging/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: contactName.trim(),
        contactType: contactType.trim(),
        channel: contactChannel,
        handle: contactHandle.trim(),
      }),
    });
    setAdding(false);
    if (!res.ok) {
      setError('Unable to add contact.');
      return;
    }
    const payload = (await res.json()) as { item: Contact };
    setContactName('');
    setContactHandle('');
    setContactType('');
    await loadContacts();
    setSelectedContactId(payload.item.id);
    setError(null);
  };

  const setPreferredContact = async (id: string) => {
    const res = await fetch(`/api/messaging/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferred: true }),
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
    setSending(true);
    const res = await fetch('/api/messaging/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contactId: selectedContactId,
        direction: composerDirection,
        body: composerBody.trim(),
      }),
    });
    setSending(false);
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
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
        <p className="mt-1 text-sm text-gray-500">Manage vendor contacts and log conversations.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add contact */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Add Contact
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className={inputClass}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Name"
          />
          <div>
            <input
              list="contact-type-options"
              className={inputClass}
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
              placeholder="Type (e.g. plumber)"
            />
            <datalist id="contact-type-options">
              {resolvedTypeSuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <select
            className={inputClass}
            value={contactChannel}
            onChange={(e) => setContactChannel(e.target.value as Contact['channel'])}
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="airbnb">Airbnb</option>
          </select>
          <input
            className={inputClass}
            value={contactHandle}
            onChange={(e) => setContactHandle(e.target.value)}
            placeholder="Phone or email"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button className={btnPrimary} disabled={adding} onClick={() => void addContact()}>
            {adding ? 'Adding…' : 'Add Contact'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Contact list */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {contacts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No contacts yet.</p>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                    contact.id === selectedContactId ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium truncate ${
                          contact.id === selectedContactId ? 'text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        {contact.displayName}
                      </span>
                      {contact.preferred && (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          preferred
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">
                      {contact.contactType} · {channelLabel[contact.channel]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{contact.handle}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          {selectedContact && !selectedContact.preferred && (
            <button
              className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 underline"
              onClick={() => void setPreferredContact(selectedContact.id)}
            >
              Set as preferred
            </button>
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white p-5 flex flex-col gap-4">
          {selectedContact ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {selectedContact.displayName}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {selectedContact.contactType}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {channelLabel[selectedContact.channel]}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Select a contact to view the conversation.</p>
          )}

          {/* Messages */}
          <div className="flex flex-col gap-2 min-h-[8rem]">
            {messages.length === 0 && selectedContact && (
              <p className="text-sm text-gray-400">No messages yet.</p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    message.direction === 'outbound'
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                  }`}
                >
                  {message.body}
                  <div
                    className={`mt-1 text-xs ${
                      message.direction === 'outbound' ? 'text-gray-400' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.sentAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
            <textarea
              className={inputClass}
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              rows={3}
              placeholder={
                selectedContact
                  ? `Message ${selectedContact.displayName}…`
                  : 'Select a contact first'
              }
              disabled={!selectedContact}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void sendMessage();
              }}
            />
            <div className="flex items-center justify-between">
              <select
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 focus:outline-none"
                value={composerDirection}
                onChange={(e) => setComposerDirection(e.target.value as 'inbound' | 'outbound')}
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
              <button
                className={btnPrimary}
                disabled={sending || !selectedContact}
                onClick={() => void sendMessage()}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
