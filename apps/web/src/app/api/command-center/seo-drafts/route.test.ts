import assert from 'node:assert/strict';
import test from 'node:test';

import { handleListSeoDrafts } from './list-handler';
import { handleRunSeoDrafts } from './run/run-handler';
import { handlePatchSeoDraft } from './[id]/patch-handler';
import { POST as runSeoDraftsRoute } from './run/route';
import { PATCH as patchSeoDraftRoute } from './[id]/route';

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

async function withEnvVar(
  key: 'OPENAI_API_KEY' | 'NODE_ENV',
  value: string | undefined,
  run: () => Promise<void>,
) {
  const env = process.env as Record<string, string | undefined>;
  const original = env[key];

  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }

  try {
    await run();
  } finally {
    if (original === undefined) {
      delete env[key];
    } else {
      env[key] = original;
    }
  }
}

void test('list handler validates query params and rejects invalid status', async () => {
  const response = await handleListSeoDrafts(
    new Request('http://localhost/api/command-center/seo-drafts?status=nope'),
    authContext,
    {
      queryDrafts: async () => [],
    },
  );

  assert.equal(response.status, 400);
});

void test('list handler validates params and scopes query by org', async () => {
  let receivedArgs:
    | {
        orgId: string;
        status?: string;
        limit: number;
      }
    | undefined;

  const response = await handleListSeoDrafts(
    new Request(
      'http://localhost/api/command-center/seo-drafts?status=needs_review&limit=7',
    ),
    authContext,
    {
      queryDrafts: async (args) => {
        receivedArgs = args;
        return [
          {
            id: 'draft-1',
            status: 'needs_review',
            titleTag: 'Stay near FC Dallas',
            slug: 'stay-near-fc-dallas',
            targetKeyword: 'frisco tx lodging near fc dallas',
            score: 88,
            eventTitle: 'FC Dallas Match',
            sourceUrl: 'https://example.com/events/fc-dallas',
            reviewNotes: [],
            updatedAt: new Date('2026-03-17T09:00:00Z').toISOString(),
          },
        ];
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(receivedArgs, {
    orgId: 'org-1',
    status: 'needs_review',
    limit: 7,
  });

  const body = (await response.json()) as {
    items: Array<{ id: string; status: string }>;
  };
  assert.equal(body.items[0]?.id, 'draft-1');
  assert.equal(body.items[0]?.status, 'needs_review');
});

void test('run handler returns 503 when OPENAI_API_KEY is missing', async () => {
  await withEnvVar('OPENAI_API_KEY', undefined, async () => {
    const response = await handleRunSeoDrafts(
      new Request('http://localhost/api/command-center/seo-drafts/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketKey: 'frisco-tx', siteKey: 'stayinfrisco' }),
      }),
      authContext,
      {
        runPipeline: async () => {
          throw new Error('should not be called');
        },
        getDraftSummaries: async () => [],
      },
    );

    assert.equal(response.status, 503);
  });
});

void test('run handler returns run summary with top drafts selected from full result set', async () => {
  await withEnvVar('OPENAI_API_KEY', 'test-key', async () => {
    let receivedDraftIds: string[] | undefined;

    const response = await handleRunSeoDrafts(
      new Request('http://localhost/api/command-center/seo-drafts/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          marketKey: 'frisco-tx',
          siteKey: 'stayinfrisco',
          maxCandidates: 6,
        }),
      }),
      authContext,
      {
        runPipeline: async () => ({
          runId: 'run-1',
          status: 'partial' as const,
          createdCandidates: 6,
          createdOpportunities: 6,
          createdDrafts: 6,
          draftIds: ['draft-1', 'draft-2', 'draft-3', 'draft-4', 'draft-5', 'draft-6'],
          sourceFailureCount: 1,
          sourceFailures: [
            {
              sourceId: 'source-1',
              sourceUrl: 'https://example.com/source',
              message: 'HTTP 500',
            },
          ],
        }),
        getDraftSummaries: async ({ draftIds }) => {
          receivedDraftIds = draftIds;
          return [
            {
              id: 'draft-6',
              status: 'needs_review',
              titleTag: 'Newest Draft',
              targetKeyword: 'things to do in frisco',
              score: 92,
              eventTitle: 'Event 6',
              updatedAt: new Date('2026-03-17T10:06:00Z').toISOString(),
            },
            {
              id: 'draft-5',
              status: 'needs_review',
              titleTag: 'Draft 5',
              targetKeyword: 'frisco events this weekend',
              score: 90,
              eventTitle: 'Event 5',
              updatedAt: new Date('2026-03-17T10:05:00Z').toISOString(),
            },
          ];
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(receivedDraftIds, [
      'draft-1',
      'draft-2',
      'draft-3',
      'draft-4',
      'draft-5',
      'draft-6',
    ]);

    const body = (await response.json()) as {
      runId: string;
      status: string;
      counts: { candidates: number; opportunities: number; drafts: number };
      sourceFailures: { count: number; items: Array<{ sourceId: string }> };
      topDrafts: Array<{ id: string }>;
    };
    assert.equal(body.runId, 'run-1');
    assert.equal(body.status, 'partial');
    assert.equal(body.counts.candidates, 6);
    assert.equal(body.counts.opportunities, 6);
    assert.equal(body.counts.drafts, 6);
    assert.equal(body.sourceFailures.count, 1);
    assert.equal(body.sourceFailures.items[0]?.sourceId, 'source-1');
    assert.equal(body.topDrafts[0]?.id, 'draft-6');
  });
});

void test('run route is protected by permission wrapper', async () => {
  await withEnvVar('NODE_ENV', 'test', async () => {
    const response = await runSeoDraftsRoute(
      new Request('http://localhost/api/command-center/seo-drafts/run', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-auth-org-id': 'org-1',
          'x-test-auth-user-id': 'user-1',
          'x-test-auth-role': 'viewer',
        },
        body: JSON.stringify({ marketKey: 'frisco-tx' }),
      }),
      {},
    );

    assert.equal(response.status, 403);
  });
});

void test('review handler rejects cross-org updates', async () => {
  const response = await handlePatchSeoDraft(
    new Request('http://localhost/api/command-center/seo-drafts/draft-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', note: 'Looks good' }),
    }),
    { id: 'draft-1' },
    authContext,
    {
      getDraftById: async () => ({
        id: 'draft-1',
        organizationId: 'org-2',
        reviewNotes: [],
      }),
      updateDraft: async () => {
        throw new Error('should not be called');
      },
    },
  );

  assert.equal(response.status, 404);
});

void test('review handler appends note and stamps reviewer metadata', async () => {
  const response = await handlePatchSeoDraft(
    new Request('http://localhost/api/command-center/seo-drafts/draft-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'needs_attention', note: 'Needs more local detail' }),
    }),
    { id: 'draft-1' },
    authContext,
    {
      getDraftById: async () => ({
        id: 'draft-1',
        organizationId: 'org-1',
        reviewNotes: ['Existing note'],
      }),
      updateDraft: async (values) => ({
        id: 'draft-1',
        status: String(values.status),
        reviewNotes: values.reviewNotes as string[],
        reviewedAt: new Date('2026-03-17T10:30:00Z').toISOString(),
        reviewedBy: String(values.reviewedBy),
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    item: { status: string; reviewNotes: string[]; reviewedBy: string };
  };
  assert.equal(body.item.status, 'needs_attention');
  assert.deepEqual(body.item.reviewNotes, ['Existing note', 'Needs more local detail']);
  assert.equal(body.item.reviewedBy, 'user-1');
});

void test('review handler maps approve action to approved status', async () => {
  const response = await handlePatchSeoDraft(
    new Request('http://localhost/api/command-center/seo-drafts/draft-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
    { id: 'draft-1' },
    authContext,
    {
      getDraftById: async () => ({
        id: 'draft-1',
        organizationId: 'org-1',
        reviewNotes: [],
      }),
      updateDraft: async (values) => ({
        id: 'draft-1',
        status: String(values.status),
        reviewNotes: values.reviewNotes as string[],
        reviewedAt: new Date('2026-03-17T10:30:00Z').toISOString(),
        reviewedBy: String(values.reviewedBy),
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { item: { status: string } };
  assert.equal(body.item.status, 'approved');
});

void test('review route is protected by permission wrapper', async () => {
  await withEnvVar('NODE_ENV', 'test', async () => {
    const response = await patchSeoDraftRoute(
      new Request('http://localhost/api/command-center/seo-drafts/draft-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-test-auth-org-id': 'org-1',
          'x-test-auth-user-id': 'user-1',
          'x-test-auth-role': 'viewer',
        },
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params: Promise.resolve({ id: 'draft-1' }) },
    );

    assert.equal(response.status, 403);
  });
});
