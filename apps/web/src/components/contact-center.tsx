'use client';

import { useEffect, useMemo, useState } from 'react';

type PropertyItem = { id: string; name: string };

type Contact = {
  id: string;
  displayName: string;
  vendorType: 'pool-maintenance' | 'plumber' | 'handyman' | 'cleaner' | 'electrician' | 'other';
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
};

const vendorTypeOptions: Contact['vendorType'][] = [
  'pool-maintenance',
  'plumber',
  'handyman',
  'cleaner',
  'electrician',
  'other'
];

export function ContactCenter() {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [vendorName, setVendorName] = useState('');
  const [vendorType, setVendorType] = useState<Contact['vendorType']>('pool-maintenance');
  const [vendorChannel, setVendorChannel] = useState<Contact['channel']>('sms');
  const [vendorHandle, setVendorHandle] = useState('');

  const [composerBody, setComposerBody] = useState('');
  const [composerDirection, setComposerDirection] = useState<'inbound' | 'outbound'>('outbound');

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const loadProperties = async () => {
    const res = await fetch('/api/properties');
    if (!res.ok) return;
    const data = (await res.json()) as { items: PropertyItem[] };
    setProperties(data.items ?? []);
  };

  const loadContacts = async () => {
    const res = await fetch('/api/messaging/contacts');
    if (!res.ok) {
      setError('Unable to load vendor contacts.');
      return;
    }
    const data = (await res.json()) as { items: Contact[] };
    const sorted = data.items ?? [];
    setContacts(sorted);
    if ((sorted.length ?? 0) > 0 && !sorted.some((c) => c.id === selectedContactId)) {
      setSelectedContactId(sorted[0]!.id);
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

  const addVendor = async () => {
    if (!vendorName.trim() || !vendorHandle.trim()) {
      setError('Vendor name and contact are required.');
      return;
    }

    const res = await fetch('/api/messaging/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: vendorName.trim(),
        vendorType,
        channel: vendorChannel,
        handle: vendorHandle.trim()
      })
    });

    if (!res.ok) {
      setError('Unable to add vendor.');
      return;
    }

    const payload = (await res.json()) as { item: Contact };
    setVendorName('');
    setVendorHandle('');
    await loadContacts();
    setSelectedContactId(payload.item.id);
    setError(null);
  };

  const sendMessage = async () => {
    if (!selectedContactId || !composerBody.trim()) {
      setError('Select a vendor and enter a message.');
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
    void Promise.all([loadProperties(), loadContacts()]);
  }, []);

  useEffect(() => {
    void loadMessages(selectedContactId);
  }, [selectedContactId]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contact Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage vendors and run conversations directly in the portal.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Add Vendor</h2>
        <p className="text-xs text-gray-500">
          Properties in database: {properties.length}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <input
            className="border rounded px-2 py-1"
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
            placeholder="Vendor name"
          />
          <select className="border rounded px-2 py-1" value={vendorType} onChange={(event) => setVendorType(event.target.value as Contact['vendorType'])}>
            {vendorTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select className="border rounded px-2 py-1" value={vendorChannel} onChange={(event) => setVendorChannel(event.target.value as Contact['channel'])}>
            <option value="sms">sms</option>
            <option value="email">email</option>
            <option value="airbnb">airbnb</option>
          </select>
          <input
            className="border rounded px-2 py-1"
            value={vendorHandle}
            onChange={(event) => setVendorHandle(event.target.value)}
            placeholder="Phone or email"
          />
          <button className="border rounded px-3 py-1" onClick={() => void addVendor()}>
            Add Vendor
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Vendor Conversations</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="border rounded px-2 py-1 min-w-72"
            value={selectedContactId}
            onChange={(event) => setSelectedContactId(event.target.value)}
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.displayName} ({contact.vendorType}) - {contact.handle}
              </option>
            ))}
          </select>
          <button className="border rounded px-3 py-1" onClick={() => void loadMessages(selectedContactId)}>
            Refresh Conversation
          </button>
        </div>

        {selectedContact ? (
          <p className="text-sm text-gray-600">
            Active vendor: <strong>{selectedContact.displayName}</strong> ({selectedContact.vendorType}) via {selectedContact.channel}
          </p>
        ) : (
          <p className="text-sm text-gray-500">No vendor selected yet.</p>
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
            placeholder="Type message to vendor"
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
