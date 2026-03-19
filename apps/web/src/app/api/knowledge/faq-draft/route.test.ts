import assert from 'node:assert/strict';
import test from 'node:test';

import { handleGenerateFaqDraft } from './route';

void test('faq draft handler returns 400 when notes are blank', async () => {
  const response = await handleGenerateFaqDraft(
    new Request('http://localhost/api/knowledge/faq-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: '   ' }),
    }),
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'notes are required');
});

void test('faq draft handler returns a normalized AI draft', async () => {
  const response = await handleGenerateFaqDraft(
    new Request('http://localhost/api/knowledge/faq-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notes:
          'Guests keep asking about parking. They should use garage spot 2. Overflow is okay after 6pm.',
        propertyName: 'Palm House',
      }),
    }),
    {
      generateDraft: async ({ notes, propertyName }) => {
        assert.equal(propertyName, 'Palm House');
        assert.equal(notes.includes('parking'), true);

        return {
          question: 'Where should guests park?',
          answer: 'Guests should use garage spot 2. Overflow parking is allowed after 6 PM.',
          topicKey: 'Parking Arrival',
        };
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    draft: { question: string; answer: string; topicKey: string };
  };
  assert.deepEqual(body.draft, {
    question: 'Where should guests park?',
    answer: 'Guests should use garage spot 2. Overflow parking is allowed after 6 PM.',
    topicKey: 'parking-arrival',
  });
});

void test('faq draft handler returns 503 when OPENAI_API_KEY is missing', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await handleGenerateFaqDraft(
      new Request('http://localhost/api/knowledge/faq-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Parking is in spot 2.' }),
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
