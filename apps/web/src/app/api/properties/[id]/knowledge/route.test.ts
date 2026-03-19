import assert from 'node:assert/strict';
import test from 'node:test';
import { knowledgeEntries } from '@walt/db';

import { handleCreatePropertyKnowledgeEntry, handleListPropertyKnowledgeEntries } from './route';
import { handleOverridePropertyKnowledgeEntry } from './[entryId]/override/route';

type TestAuthContext = {
  orgId: string;
  userId: string;
  role: 'owner';
};

const authContext: TestAuthContext = {
  orgId: 'org-1',
  userId: 'user-1',
  role: 'owner',
};

type KnowledgeEntryRow = typeof knowledgeEntries.$inferSelect;
type KnowledgeCreateValues = {
  organizationId: string;
  scope: string;
  propertyId: string | null;
  entryType: string;
  topicKey: string;
  title: string | null;
  question: string | null;
  answer: string | null;
  body: string | null;
  channels: string[];
  status: string;
  sortOrder: number;
  slug: string | null;
};

void test('property knowledge list includes inherited global rows and property overrides them by topic', async () => {
  let receivedScopes: string[] = [];

  const response = await handleListPropertyKnowledgeEntries(
    new Request('http://localhost/api/properties/prop-1/knowledge'),
    { params: Promise.resolve({ id: 'prop-1' }) },
    authContext,
    {
      queryKnowledgeEntries: async (args: {
        scope: string;
      }): Promise<KnowledgeEntryRow[]> => {
        receivedScopes.push(args.scope);
        if (args.scope === 'global') {
          return [
            {
              id: 'k-global',
              organizationId: 'org-1',
              scope: 'global',
              propertyId: null,
              entryType: 'faq',
              topicKey: 'parking',
              title: null,
              question: 'Where do I park?',
              answer: 'Street parking only.',
              body: null,
              channels: ['ai', 'website'],
              status: 'published',
              sortOrder: 0,
              slug: null,
              createdAt: new Date('2026-03-18T12:00:00.000Z'),
              updatedAt: new Date('2026-03-18T12:00:00.000Z'),
            },
            {
              id: 'k-global-wifi',
              organizationId: 'org-1',
              scope: 'global',
              propertyId: null,
              entryType: 'faq',
              topicKey: 'wifi',
              title: null,
              question: 'What is the Wi-Fi password?',
              answer: 'MapleGuest2026',
              body: null,
              channels: ['ai', 'website'],
              status: 'published',
              sortOrder: 1,
              slug: null,
              createdAt: new Date('2026-03-18T12:00:00.000Z'),
              updatedAt: new Date('2026-03-18T12:00:00.000Z'),
            },
          ];
        }

        return [
          {
            id: 'k-property',
            organizationId: 'org-1',
            scope: 'property',
            propertyId: 'prop-1',
            entryType: 'faq',
            topicKey: 'parking',
            title: null,
            question: 'Where do I park?',
            answer: 'Garage spot 2.',
            body: null,
            channels: ['ai', 'website'],
            status: 'published',
            sortOrder: 0,
            slug: null,
            createdAt: new Date('2026-03-18T12:00:00.000Z'),
            updatedAt: new Date('2026-03-18T12:00:00.000Z'),
          },
        ];
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(receivedScopes.sort(), ['global', 'property']);

  const body = (await response.json()) as { items: Array<{ id: string; answer: string; topicKey: string }> };
  assert.equal(body.items.some((item) => item.topicKey === 'wifi' && item.id === 'k-global-wifi'), true);
  assert.equal(
    body.items.some((item) => item.topicKey === 'parking' && item.id === 'k-property' && item.answer === 'Garage spot 2.'),
    true,
  );
  assert.equal(body.items.some((item) => item.id === 'k-global' && item.topicKey === 'parking'), false);
});

void test('property knowledge override clones a global row into a property draft', async () => {
  let receivedInsert:
    | {
        organizationId: string;
        scope: string;
        propertyId: string | null;
        topicKey: string;
        entryType: string;
        status: string;
      }
    | undefined;

  const response = await handleOverridePropertyKnowledgeEntry(
    new Request('http://localhost/api/properties/prop-1/knowledge/k-global/override', {
      method: 'POST',
    }),
    { params: Promise.resolve({ id: 'prop-1', entryId: 'k-global' }) },
    authContext,
    {
      getKnowledgeEntryById: async (): Promise<KnowledgeEntryRow> => ({
        id: 'k-global',
        organizationId: 'org-1',
        scope: 'global',
        propertyId: null,
        entryType: 'faq',
        topicKey: 'parking',
        title: null,
        question: 'Where do I park?',
        answer: 'Street parking only.',
        body: null,
        channels: ['ai', 'website'],
        status: 'published',
        sortOrder: 2,
        slug: null,
        createdAt: new Date('2026-03-18T12:00:00.000Z'),
        updatedAt: new Date('2026-03-18T12:00:00.000Z'),
      }),
      queryKnowledgeEntries: async (): Promise<KnowledgeEntryRow[]> => [],
      createKnowledgeEntry: async (values: KnowledgeCreateValues): Promise<KnowledgeEntryRow> => {
        receivedInsert = values;
        return {
          id: 'k-property',
          ...values,
          createdAt: new Date('2026-03-18T13:00:00.000Z'),
          updatedAt: new Date('2026-03-18T13:00:00.000Z'),
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(receivedInsert, {
    organizationId: 'org-1',
    scope: 'property',
    propertyId: 'prop-1',
    entryType: 'faq',
    topicKey: 'parking',
    title: null,
    question: 'Where do I park?',
    answer: 'Street parking only.',
    body: null,
    channels: ['ai', 'website'],
    status: 'draft',
    sortOrder: 2,
    slug: null,
  });

  const body = (await response.json()) as { item: { id: string; scope: string; propertyId: string } };
  assert.equal(body.item.id, 'k-property');
  assert.equal(body.item.scope, 'property');
  assert.equal(body.item.propertyId, 'prop-1');
});

void test('property knowledge override updates an existing property entry for the same topic', async () => {
  let receivedPatch:
    | {
        knowledgeId: string;
        scope: string;
        values: Record<string, unknown>;
      }
    | undefined;

  const response = await handleOverridePropertyKnowledgeEntry(
    new Request('http://localhost/api/properties/prop-1/knowledge/k-global/override', {
      method: 'POST',
    }),
    { params: Promise.resolve({ id: 'prop-1', entryId: 'k-global' }) },
    authContext,
    {
      getKnowledgeEntryById: async (): Promise<KnowledgeEntryRow> => ({
        id: 'k-global',
        organizationId: 'org-1',
        scope: 'global',
        propertyId: null,
        entryType: 'faq',
        topicKey: 'parking',
        title: null,
        question: 'Where do I park?',
        answer: 'Street parking only.',
        body: null,
        channels: ['ai', 'website'],
        status: 'published',
        sortOrder: 2,
        slug: null,
        createdAt: new Date('2026-03-18T12:00:00.000Z'),
        updatedAt: new Date('2026-03-18T12:00:00.000Z'),
      }),
      queryKnowledgeEntries: async (): Promise<KnowledgeEntryRow[]> => [
        {
          id: 'k-existing',
          organizationId: 'org-1',
          scope: 'property',
          propertyId: 'prop-1',
          entryType: 'faq',
          topicKey: 'parking',
          title: null,
          question: 'Old parking question',
          answer: 'Old parking answer',
          body: null,
          channels: ['ai'],
          status: 'published',
          sortOrder: 0,
          slug: null,
          createdAt: new Date('2026-03-18T12:00:00.000Z'),
          updatedAt: new Date('2026-03-18T12:00:00.000Z'),
        },
      ],
      patchKnowledgeEntry: async (args) => {
        receivedPatch = {
          knowledgeId: args.knowledgeId,
          scope: args.scope,
          values: args.values,
        };
        return {
          id: 'k-existing',
          organizationId: 'org-1',
          scope: 'property',
          propertyId: 'prop-1',
          entryType: 'faq',
          topicKey: 'parking',
          title: null,
          question: 'Where do I park?',
          answer: 'Street parking only.',
          body: null,
          channels: ['ai', 'website'],
          status: 'draft',
          sortOrder: 2,
          slug: null,
          createdAt: new Date('2026-03-18T12:00:00.000Z'),
          updatedAt: new Date('2026-03-18T13:00:00.000Z'),
        };
      },
      createKnowledgeEntry: async () => {
        throw new Error('should not create duplicate property override');
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(receivedPatch?.knowledgeId, 'k-existing');
  assert.equal(receivedPatch?.scope, 'property');
  assert.deepEqual(receivedPatch?.values, {
    entryType: 'faq',
    title: undefined,
    question: 'Where do I park?',
    answer: 'Street parking only.',
    body: undefined,
    channels: ['ai', 'website'],
    status: 'draft',
    sortOrder: 2,
    slug: undefined,
  });
});

void test('property knowledge create persists a property-scoped draft entry', async () => {
  let receivedInsert:
    | {
        organizationId: string;
        scope: string;
        propertyId: string | null;
        entryType: string;
        topicKey: string;
        status: string;
      }
    | undefined;

  const response = await handleCreatePropertyKnowledgeEntry(
    new Request('http://localhost/api/properties/prop-1/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entryType: 'faq',
        topicKey: 'wifi',
        question: 'What is the Wi-Fi password?',
        answer: 'MapleGuest2026',
        channels: ['ai', 'website'],
      }),
    }),
    { params: Promise.resolve({ id: 'prop-1' }) },
    authContext,
    {
      createKnowledgeEntry: async (values: KnowledgeCreateValues): Promise<KnowledgeEntryRow> => {
        receivedInsert = values;
        return {
          id: 'k-created',
          ...values,
          createdAt: new Date('2026-03-18T13:00:00.000Z'),
          updatedAt: new Date('2026-03-18T13:00:00.000Z'),
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal(receivedInsert?.organizationId, 'org-1');
  assert.equal(receivedInsert?.scope, 'property');
  assert.equal(receivedInsert?.propertyId, 'prop-1');
  assert.equal(receivedInsert?.entryType, 'faq');
  assert.equal(receivedInsert?.topicKey, 'wifi');
  assert.equal(receivedInsert?.status, 'draft');
});
