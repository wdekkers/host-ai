import assert from 'node:assert/strict';
import test from 'node:test';
import { knowledgeEntries } from '@walt/db';

import { handleGetAgentConfig } from '../agent-config/route';
import { handleGetPropertyAgentConfig } from '../properties/[id]/agent-config/route';
import {
  handleCreateKnowledgeEntry,
  handleListKnowledgeEntries,
  handlePatchKnowledgeEntry,
} from './route';

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

void test('global agent config GET returns current row', async () => {
  const response = await handleGetAgentConfig(new Request('http://localhost/api/agent-config'), authContext, {
    queryConfig: async () => ({
      id: 'cfg-1',
      organizationId: 'org-1',
      scope: 'global',
      propertyId: null,
      tone: 'warm',
      emojiUse: 'light',
      responseLength: 'balanced',
      escalationRules: null,
      specialInstructions: null,
      createdAt: new Date('2026-03-18T12:00:00.000Z'),
      updatedAt: new Date('2026-03-18T12:00:00.000Z'),
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { config: { id: string } };
  assert.equal(body.config.id, 'cfg-1');
});

void test('global agent config GET returns null when absent', async () => {
  const response = await handleGetAgentConfig(new Request('http://localhost/api/agent-config'), authContext, {
    queryConfig: async () => null,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { config: null };
  assert.equal(body.config, null);
});

void test('property agent config GET returns override row', async () => {
  const response = await handleGetPropertyAgentConfig(
    new Request('http://localhost/api/properties/prop-1/agent-config'),
    { params: Promise.resolve({ id: 'prop-1' }) },
    authContext,
    {
      queryConfig: async () => ({
        id: 'cfg-2',
        organizationId: 'org-1',
        scope: 'property',
        propertyId: 'prop-1',
        tone: 'formal',
        emojiUse: 'none',
        responseLength: 'short',
        escalationRules: null,
        specialInstructions: 'No emojis.',
        createdAt: new Date('2026-03-18T12:00:00.000Z'),
        updatedAt: new Date('2026-03-18T12:00:00.000Z'),
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { config: { id: string } };
  assert.equal(body.config.id, 'cfg-2');
});

void test('property agent config GET returns null when absent', async () => {
  const response = await handleGetPropertyAgentConfig(
    new Request('http://localhost/api/properties/prop-1/agent-config'),
    { params: Promise.resolve({ id: 'prop-1' }) },
    authContext,
    {
      queryConfig: async () => null,
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { config: null };
  assert.equal(body.config, null);
});

void test('global knowledge list filters by org, scope, channel, and status', async () => {
  let receivedArgs:
    | {
        orgId: string;
        scope: string;
        channel?: string;
        status?: string;
      }
    | undefined;

  const response = await handleListKnowledgeEntries(
    new Request('http://localhost/api/knowledge?scope=global&channel=ai&status=published'),
    authContext,
    {
      queryKnowledgeEntries: async (args) => {
        receivedArgs = args;
        return [
          {
            id: 'k-1',
            organizationId: 'org-1',
            scope: 'global',
            propertyId: null,
            entryType: 'faq',
            topicKey: 'parking',
            title: null,
            question: 'Where do I park?',
            answer: 'Street parking only.',
            body: null,
            channels: ['ai'],
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
  assert.deepEqual(receivedArgs, {
    orgId: 'org-1',
    scope: 'global',
    propertyId: null,
    channel: 'ai',
    status: 'published',
    entryType: undefined,
    topicKey: undefined,
  });

  const body = (await response.json()) as { items: Array<{ id: string }> };
  assert.equal(body.items[0]?.id, 'k-1');
});

void test('global knowledge create persists a global draft entry', async () => {
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

  const response = await handleCreateKnowledgeEntry(
    new Request('http://localhost/api/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entryType: 'faq',
        topicKey: 'parking',
        question: 'Where do I park?',
        answer: 'Street parking only.',
        channels: ['ai', 'website'],
      }),
    }),
    authContext,
    {
      createKnowledgeEntry: async (values) => {
        receivedInsert = values;
        return {
          id: 'k-created',
          ...values,
          createdAt: new Date('2026-03-18T12:00:00.000Z'),
          updatedAt: new Date('2026-03-18T12:00:00.000Z'),
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal(receivedInsert?.organizationId, 'org-1');
  assert.equal(receivedInsert?.scope, 'global');
  assert.equal(receivedInsert?.propertyId, null);
  assert.equal(receivedInsert?.entryType, 'faq');
  assert.equal(receivedInsert?.topicKey, 'parking');
  assert.equal(receivedInsert?.status, 'draft');
});

void test('global knowledge patch only updates global rows', async () => {
  let receivedPatch:
    | {
        orgId: string;
        knowledgeId: string;
        scope: string;
        values: Record<string, unknown>;
      }
    | undefined;

  const response = await handlePatchKnowledgeEntry(
    new Request('http://localhost/api/knowledge/k-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: 'Where do guests park?',
        answer: 'Use street parking only.',
      }),
    }),
    { params: Promise.resolve({ id: 'k-1' }) },
    authContext,
    {
      patchKnowledgeEntry: async (args) => {
        receivedPatch = {
          orgId: args.orgId,
          knowledgeId: args.knowledgeId,
          scope: args.scope,
          values: args.values,
        };
        return {
          id: 'k-1',
          organizationId: 'org-1',
          scope: 'global',
          propertyId: null,
          entryType: 'faq',
          topicKey: 'parking',
          title: null,
          question: 'Where do guests park?',
          answer: 'Use street parking only.',
          body: null,
          channels: ['ai', 'website'],
          status: 'published',
          sortOrder: 0,
          slug: null,
          createdAt: new Date('2026-03-18T12:00:00.000Z'),
          updatedAt: new Date('2026-03-18T12:10:00.000Z'),
        } satisfies KnowledgeEntryRow;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(receivedPatch?.orgId, 'org-1');
  assert.equal(receivedPatch?.knowledgeId, 'k-1');
  assert.equal(receivedPatch?.scope, 'global');
  assert.deepEqual(receivedPatch?.values, {
    scope: 'global',
    propertyId: null,
    question: 'Where do guests park?',
    answer: 'Use street parking only.',
  });
});
