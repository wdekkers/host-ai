export type FallbackContact = {
  id: string;
  displayName: string;
  contactType: string;
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
  preferred: boolean;
  lastMessageAt: string;
};

export type FallbackMessage = {
  id: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
};

const contacts: FallbackContact[] = [
  {
    id: 'contact-001',
    displayName: 'Blue Wave Pools',
    contactType: 'pool-maintenance',
    channel: 'sms',
    handle: '+1-555-0101',
    preferred: true,
    lastMessageAt: '2026-03-08T11:00:00.000Z'
  },
  {
    id: 'contact-002',
    displayName: 'Rapid Rooter',
    contactType: 'plumber',
    channel: 'sms',
    handle: '+1-555-0132',
    preferred: false,
    lastMessageAt: '2026-03-08T09:30:00.000Z'
  }
];

const messages: FallbackMessage[] = [
  {
    id: 'message-001',
    contactId: 'contact-001',
    direction: 'inbound',
    body: 'Pool light is flickering. Can we check it today?',
    sentAt: '2026-03-08T10:30:00.000Z'
  },
  {
    id: 'message-002',
    contactId: 'contact-001',
    direction: 'outbound',
    body: 'Yes, please stop by after 2 PM and send an ETA.',
    sentAt: '2026-03-08T11:00:00.000Z'
  }
];

const sortContacts = (items: FallbackContact[]) =>
  [...items].sort((left, right) => Number(right.preferred) - Number(left.preferred) || right.lastMessageAt.localeCompare(left.lastMessageAt));

export const listFallbackContacts = () => sortContacts(contacts);

export const createFallbackContact = (input: {
  displayName: string;
  contactType: string;
  channel: 'sms' | 'airbnb' | 'email';
  handle: string;
  preferred?: boolean;
}) => {
  const now = new Date().toISOString();
  if (input.preferred) {
    for (const contact of contacts) {
      contact.preferred = false;
    }
  }

  const item: FallbackContact = {
    id: `contact-${String(contacts.length + 1).padStart(3, '0')}`,
    displayName: input.displayName,
    contactType: input.contactType,
    channel: input.channel,
    handle: input.handle,
    preferred: Boolean(input.preferred),
    lastMessageAt: now
  };
  contacts.unshift(item);
  return item;
};

export const setFallbackPreferredContact = (id: string, preferred: boolean) => {
  const contact = contacts.find((item) => item.id === id);
  if (!contact) {
    return null;
  }

  if (preferred) {
    for (const item of contacts) {
      item.preferred = item.id === id;
    }
  } else {
    contact.preferred = false;
  }

  return contact;
};

export const listFallbackMessages = (contactId?: string) => {
  const filtered = contactId ? messages.filter((item) => item.contactId === contactId) : messages;
  return [...filtered].sort((left, right) => right.sentAt.localeCompare(left.sentAt));
};

export const createFallbackMessage = (input: {
  contactId: string;
  direction: 'inbound' | 'outbound';
  body: string;
}) => {
  const contact = contacts.find((item) => item.id === input.contactId);
  if (!contact) {
    return null;
  }

  const sentAt = new Date().toISOString();
  const item: FallbackMessage = {
    id: `message-${String(messages.length + 1).padStart(3, '0')}`,
    contactId: input.contactId,
    direction: input.direction,
    body: input.body,
    sentAt
  };

  messages.push(item);
  contact.lastMessageAt = sentAt;
  return item;
};
