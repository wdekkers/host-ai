'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';
import { Search, Star, Plus, Phone, Mail, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Contact = {
  id: string;
  displayName: string;
  contactType: string;
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
  preferred: boolean;
};

const contactTypeSuggestions = [
  'pool-maintenance',
  'plumber',
  'handyman',
  'cleaner',
  'electrician',
];

const channelIcon: Record<Contact['channel'], typeof Phone> = {
  sms: Phone,
  email: Mail,
  airbnb: User,
};

export function ContactCenter() {
  const { getToken } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactType, setContactType] = useState('');
  const [contactChannel, setContactChannel] = useState<Contact['channel']>('sms');
  const [contactHandle, setContactHandle] = useState('');

  const authHeader = async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadContacts = async () => {
    const res = await fetch('/api/contacts', { headers: await authHeader() });
    if (!res.ok) {
      setError('Unable to load contacts.');
      return;
    }
    const data = (await res.json()) as { items: Contact[] };
    setContacts(data.items ?? []);
    setError(null);
  };

  const addContact = async () => {
    if (!contactName.trim() || !contactHandle.trim() || !contactType.trim()) {
      setError('Name, type, and contact details are required.');
      return;
    }
    setAdding(true);
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...await authHeader() },
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
    setContactName('');
    setContactHandle('');
    setContactType('');
    setShowForm(false);
    await loadContacts();
  };

  const togglePreferred = async (id: string, preferred: boolean) => {
    await fetch(`/api/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...await authHeader() },
      body: JSON.stringify({ preferred }),
    });
    await loadContacts();
  };

  useEffect(() => {
    void loadContacts();
  }, []);

  const allTypes = useMemo(() => {
    const dynamic = contacts.map((c) => c.contactType.trim()).filter(Boolean);
    return Array.from(new Set([...contactTypeSuggestions, ...dynamic])).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (typeFilter && c.contactType !== typeFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.contactType.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q)
      );
    });
  }, [contacts, search, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Contact
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add contact form */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
              />
              <div>
                <input
                  list="contact-type-options"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value)}
                  placeholder="Type (e.g. plumber)"
                />
                <datalist id="contact-type-options">
                  {allTypes.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={contactChannel}
                onChange={(e) => setContactChannel(e.target.value as Contact['channel'])}
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="airbnb">Airbnb</option>
              </select>
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={contactHandle}
                onChange={(e) => setContactHandle(e.target.value)}
                placeholder="Phone or email"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" disabled={adding} onClick={() => void addContact()}>
                {adding ? 'Adding...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            {contacts.length === 0 ? 'No contacts yet. Add your first contact.' : 'No contacts match your search.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const Icon = channelIcon[c.channel];
                return (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <button
                      onClick={() => void togglePreferred(c.id, !c.preferred)}
                      className="shrink-0"
                      title={c.preferred ? 'Remove preferred' : 'Mark as preferred'}
                    >
                      <Star className={`h-4 w-4 ${c.preferred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{c.displayName}</span>
                        <Badge variant="secondary" className="text-xs">{c.contactType}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                        <Icon className="h-3 w-3" />
                        <span>{c.handle}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
