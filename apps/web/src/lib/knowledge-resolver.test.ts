import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatKnowledgeForPrompt,
  listKnowledgeEntriesForScope,
  mergeKnowledgeEntries,
  resolveKnowledgeForProperty,
} from './knowledge-resolver';

function makeEntry(overrides: {
  id?: string;
  scope?: 'global' | 'property';
  propertyId?: string | null;
  topicKey?: string;
  entryType?: 'faq' | 'guidebook' | 'policy' | 'amenity' | 'checkin' | 'checkout';
  title?: string | null;
  question?: string | null;
  answer?: string | null;
  body?: string | null;
  channels?: Array<'ai' | 'website' | 'guidebook'>;
  status?: 'draft' | 'published' | 'archived';
  sortOrder?: number;
}) {
  const now = '2026-03-18T12:00:00.000Z';
  return {
    id: overrides.id ?? `${overrides.scope ?? 'global'}-${overrides.topicKey ?? 'topic'}`,
    organizationId: 'org-1',
    scope: overrides.scope ?? 'global',
    propertyId: overrides.propertyId ?? null,
    entryType: overrides.entryType ?? 'faq',
    topicKey: overrides.topicKey ?? 'topic',
    title: overrides.title ?? null,
    question: overrides.question ?? null,
    answer: overrides.answer ?? null,
    body: overrides.body ?? null,
    channels: overrides.channels ?? ['ai'],
    status: overrides.status ?? 'published',
    sortOrder: overrides.sortOrder ?? 0,
    slug: null,
    createdAt: now,
    updatedAt: now,
  };
}

void test('listKnowledgeEntriesForScope filters to published entries for the requested channel', async () => {
  const source = {
    listKnowledgeEntries: async () => [
      makeEntry({ id: 'a', topicKey: 'parking', channels: ['ai'], status: 'published' }),
      makeEntry({ id: 'b', topicKey: 'wifi', channels: ['website'], status: 'published' }),
      makeEntry({ id: 'c', topicKey: 'pets', channels: ['ai'], status: 'draft' }),
    ],
  };

  const result = await listKnowledgeEntriesForScope({
    source,
    organizationId: 'org-1',
    scope: 'global',
    channels: ['ai'],
  });

  assert.deepEqual(
    result.map((entry) => entry.topicKey),
    ['parking'],
  );
});

void test('mergeKnowledgeEntries prefers property entries for duplicate topic keys', () => {
  const result = mergeKnowledgeEntries({
    globalEntries: [makeEntry({ id: 'g-parking', topicKey: 'parking', answer: 'Street only' })],
    propertyEntries: [
      makeEntry({
        id: 'p-parking',
        scope: 'property',
        propertyId: 'prop-1',
        topicKey: 'parking',
        answer: 'Garage spot 2',
      }),
    ],
  });

  assert.equal(result.find((entry) => entry.topicKey === 'parking')?.answer, 'Garage spot 2');
});

void test('resolveKnowledgeForProperty includes global entries for a property request', async () => {
  const source = {
    listKnowledgeEntries: async ({ scope }: { scope: 'global' | 'property' }) => {
      if (scope === 'global') {
        return [
          makeEntry({
            id: 'g-wifi',
            topicKey: 'wifi',
            answer: 'Network name and password are on the card.',
          }),
        ];
      }

      return [
        makeEntry({
          id: 'p-parking',
          scope: 'property',
          propertyId: 'prop-1',
          topicKey: 'parking',
          answer: 'Park in spot 2.',
        }),
      ];
    },
  };

  const result = await resolveKnowledgeForProperty({
    source,
    organizationId: 'org-1',
    propertyId: 'prop-1',
    channels: ['ai'],
  });

  assert.equal(
    result.some((entry) => entry.topicKey === 'wifi'),
    true,
  );
  assert.equal(
    result.some((entry) => entry.topicKey === 'parking'),
    true,
  );
});

void test('resolveKnowledgeForProperty still returns global entries without a property id', async () => {
  const source = {
    listKnowledgeEntries: async ({ scope }: { scope: 'global' | 'property' }) => {
      if (scope === 'global') {
        return [
          makeEntry({
            id: 'g-checkin',
            topicKey: 'checkin',
            answer: 'The door code arrives at noon.',
          }),
        ];
      }

      return [];
    },
  };

  const result = await resolveKnowledgeForProperty({
    source,
    organizationId: 'org-1',
    propertyId: null,
    channels: ['ai'],
  });

  assert.equal(
    result.some((entry) => entry.topicKey === 'checkin'),
    true,
  );
});

void test('resolveKnowledgeForProperty caps prompt knowledge entries deterministically', async () => {
  const source = {
    listKnowledgeEntries: async ({ scope }: { scope: 'global' | 'property' }) => {
      if (scope === 'global') {
        return [
          makeEntry({ id: 'g-a', topicKey: 'a', sortOrder: 0 }),
          makeEntry({ id: 'g-b', topicKey: 'b', sortOrder: 1 }),
          makeEntry({ id: 'g-c', topicKey: 'c', sortOrder: 2 }),
        ];
      }

      return [];
    },
  };

  const result = await resolveKnowledgeForProperty({
    source,
    organizationId: 'org-1',
    propertyId: null,
    channels: ['ai'],
    maxEntries: 2,
  });

  assert.deepEqual(
    result.map((entry) => entry.topicKey),
    ['a', 'b'],
  );
});

void test('listKnowledgeEntriesForScope rejects property scope without property id', async () => {
  const source = {
    listKnowledgeEntries: async () => [],
  };

  await assert.rejects(
    () =>
      listKnowledgeEntriesForScope({
        source,
        organizationId: 'org-1',
        scope: 'property',
      }),
    /propertyId is required/,
  );
});

void test('formatKnowledgeForPrompt renders readable knowledge text', () => {
  const prompt = formatKnowledgeForPrompt([
    makeEntry({
      topicKey: 'parking',
      question: 'Where do I park?',
      answer: 'Use spot 2.',
    }),
    makeEntry({
      topicKey: 'guidebook-wifi',
      scope: 'property',
      propertyId: 'prop-1',
      entryType: 'guidebook',
      title: 'Wi-Fi',
      body: 'SSID is Maple Guest.',
    }),
  ]);

  assert.equal(prompt.includes('parking'), true);
  assert.equal(prompt.includes('Where do I park?'), true);
  assert.equal(prompt.includes('Wi-Fi'), true);
  assert.equal(prompt.includes('Maple Guest'), true);
});
