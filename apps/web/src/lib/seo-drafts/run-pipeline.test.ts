import assert from 'node:assert/strict';
import test from 'node:test';

import {
  rankCandidatesForDrafting,
  scoreCandidate,
  shouldDraftOpportunity,
} from './opportunity-scorer';
import { scoutEvents } from './event-scout';
import { reviewDraft } from './reviewer';

void test('scores near-term Frisco events higher than generic regional noise', () => {
  const strong = scoreCandidate({
    title: 'Frisco RoughRiders Home Game',
    city: 'Frisco',
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    summary: 'Family-friendly baseball at Riders Field for weekend visitors.',
    venueName: 'Riders Field',
    sourceUrl: 'https://example.com/riders',
  });

  const weak = scoreCandidate({
    title: 'North Texas Sale Weekend',
    city: 'Dallas',
    startsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    summary: 'Generic shopping promotion',
    venueName: 'Downtown',
    sourceUrl: 'https://example.com/sale',
  });

  assert.equal(strong.score > weak.score, true);
  assert.equal(strong.reasons.length > 0, true);
});

void test('low-scoring candidates are skipped by the draft threshold', () => {
  const weak = scoreCandidate({
    title: 'North Texas Sale Weekend',
    city: 'Dallas',
    startsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    summary: 'Generic shopping promotion',
    venueName: 'Downtown',
    sourceUrl: 'https://example.com/sale',
  });

  assert.equal(weak.score, 0);
  assert.equal(shouldDraftOpportunity(weak), false);
});

void test('ranking applies before maxCandidates so quality beats discovery order', () => {
  const ranked = rankCandidatesForDrafting(
    [
      {
        id: 'weak-first',
        sourceId: 'source-1',
        sourceUrl: 'https://example.com/weak',
        sourceDomain: 'example.com',
        title: 'North Texas Sale Weekend',
        venueName: 'Downtown',
        city: 'Dallas',
        startsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        endsAt: null,
        summary: 'Generic shopping promotion',
        sourceSnippet: 'shopping promotion',
        normalizedHash: 'weak',
        raw: {},
      },
      {
        id: 'strong-second',
        sourceId: 'source-2',
        sourceUrl: 'https://example.com/strong',
        sourceDomain: 'example.com',
        title: 'Frisco RoughRiders Home Game',
        venueName: 'Riders Field',
        city: 'Frisco',
        startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endsAt: null,
        summary: 'Family-friendly baseball at Riders Field for weekend visitors.',
        sourceSnippet: 'home game',
        normalizedHash: 'strong',
        raw: {},
      },
    ],
    [],
    1,
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.candidate.id, 'strong-second');
});

void test('reviewer flags drafts missing source grounding or CTA', () => {
  const result = reviewDraft({
    titleTag: 'Stay Near Frisco Event',
    metaDescription: 'A draft',
    slug: 'frisco-event',
    h1: 'Stay Near Frisco Event',
    outline: ['Intro', 'Where to stay', 'FAQ'],
    bodyMarkdown: 'Short body',
    faqItems: [],
    ctaText: '',
    sourceUrls: [],
    generatedAt: new Date(),
  });

  assert.equal(result.status, 'needs_attention');
  assert.equal(result.notes.includes('Missing source URLs'), true);
  assert.equal(result.notes.includes('Missing CTA text'), true);
});

void test('scout continues when one source extractor fails', async () => {
  const result = await scoutEvents({
    sources: [
      { id: 'bad-source', label: 'Bad Source', url: 'https://example.com/bad', city: 'Frisco' },
      {
        id: 'good-source',
        label: 'Good Source',
        url: 'https://example.com/good',
        city: 'Frisco',
      },
    ],
    fetchImpl: async () =>
      new Response('<html><body>Frisco event listings</body></html>', { status: 200 }),
    extractor: async ({ sourceId }) => {
      if (sourceId === 'bad-source') {
        throw new Error('broken source');
      }

      return [
        {
          title: 'Frisco Arts Festival',
          city: 'Frisco',
          venueName: 'Frisco Square',
          startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Weekend arts festival in Frisco.',
        },
      ];
    },
  });

  assert.equal(result.partial, true);
  assert.equal(result.sourceFailures.length, 1);
  assert.equal(result.sourceFailures[0]?.sourceId, 'bad-source');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.sourceId, 'good-source');
});

void test('scout records non-ok HTTP responses as source failures', async () => {
  const result = await scoutEvents({
    sources: [
      {
        id: 'missing-source',
        label: 'Missing Source',
        url: 'https://example.com/missing',
        city: 'Frisco',
      },
    ],
    fetchImpl: async () => new Response('not found', { status: 404, statusText: 'Not Found' }),
    extractor: async () => [],
  });

  assert.equal(result.partial, true);
  assert.equal(result.sourceFailures.length, 1);
  assert.equal(result.sourceFailures[0]?.sourceId, 'missing-source');
  assert.equal(result.sourceFailures[0]?.message.includes('404'), true);
  assert.equal(result.candidates.length, 0);
});

void test('scout fails explicitly when OPENAI_API_KEY is missing and default extractor is used', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      () =>
        scoutEvents({
          sources: [
            {
              id: 'visit-frisco-events',
              label: 'Visit Frisco Events',
              url: 'https://example.com/events',
              city: 'Frisco',
            },
          ],
          fetchImpl: async () =>
            new Response('<html><body>Frisco event listings</body></html>', { status: 200 }),
        }),
      /OPENAI_API_KEY is required for SEO event scouting/,
    );
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});
