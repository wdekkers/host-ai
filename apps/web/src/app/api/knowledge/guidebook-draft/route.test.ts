import assert from 'node:assert/strict';
import test from 'node:test';

import { handleGenerateGuidebookDraft } from './route';

void test('guidebook draft handler returns 400 when notes are blank', async () => {
  const response = await handleGenerateGuidebookDraft(
    new Request('http://localhost/api/knowledge/guidebook-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: '   ' }),
    }),
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'notes are required');
});

void test('guidebook draft handler returns a normalized AI draft', async () => {
  const response = await handleGenerateGuidebookDraft(
    new Request('http://localhost/api/knowledge/guidebook-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notes:
          'Pool heating must be requested 24 hours ahead. It costs 45 dollars per night. Tell guests to message us before arrival.',
        propertyName: 'Palm House',
      }),
    }),
    {
      generateDraft: async ({ notes, propertyName }) => {
        assert.equal(propertyName, 'Palm House');
        assert.equal(notes.includes('Pool heating'), true);

        return {
          title: 'Pool Heating',
          body: 'Pool heating must be requested at least 24 hours before arrival and costs $45 per night. Guests should message us before arrival to arrange it.',
          topicKey: 'Pool Heating',
          status: 'published',
        };
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    draft: { title: string; body: string; topicKey: string; status: string };
  };
  assert.deepEqual(body.draft, {
    title: 'Pool Heating',
    body: 'Pool heating must be requested at least 24 hours before arrival and costs $45 per night. Guests should message us before arrival to arrange it.',
    topicKey: 'pool-heating',
    status: 'published',
  });
});

void test('guidebook draft handler defaults invalid AI status suggestions to draft', async () => {
  const response = await handleGenerateGuidebookDraft(
    new Request('http://localhost/api/knowledge/guidebook-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notes: 'Maybe add a section about the backup heater instructions later.',
      }),
    }),
    {
      generateDraft: async () => ({
        title: 'Backup Heater',
        body: 'A backup heater is available if temperatures drop suddenly.',
        topicKey: 'backup-heater',
        status: 'pending-review',
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    draft: { title: string; body: string; topicKey: string; status: string };
  };
  assert.equal(body.draft.status, 'draft');
});

void test('guidebook draft handler returns 503 when OPENAI_API_KEY is missing', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await handleGenerateGuidebookDraft(
      new Request('http://localhost/api/knowledge/guidebook-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Pool heating needs 24 hours notice.' }),
      }),
    );

    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, 'OPENAI_API_KEY not configured.');
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});
