import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLegacyKnowledgeBackfillPayloads,
  mapLegacyPropertyFaqToKnowledgeEntry,
  mapLegacyPropertyGuidebookEntryToKnowledgeEntry,
} from './knowledge-backfill';

void test('property FAQ rows map to property-scoped faq knowledge entries', () => {
  const entry = mapLegacyPropertyFaqToKnowledgeEntry({
    organizationId: 'org-1',
    propertyId: 'prop-1',
    category: 'Parking & Arrival',
    question: 'Where should guests park when they arrive?',
    answer: 'Use garage spot 2 and the overflow driveway.',
    analysedAt: new Date('2026-03-18T10:00:00.000Z'),
    updatedAt: new Date('2026-03-18T11:00:00.000Z'),
  });

  assert.equal(entry.organizationId, 'org-1');
  assert.equal(entry.scope, 'property');
  assert.equal(entry.propertyId, 'prop-1');
  assert.equal(entry.entryType, 'faq');
  assert.equal(entry.topicKey, 'parking-arrival');
  assert.equal(entry.question, 'Where should guests park when they arrive?');
  assert.equal(entry.answer, 'Use garage spot 2 and the overflow driveway.');
  assert.deepEqual(entry.channels, ['ai', 'website']);
  assert.equal(entry.status, 'published');
});

void test('guidebook rows map to property-scoped guidebook knowledge entries', () => {
  const entry = mapLegacyPropertyGuidebookEntryToKnowledgeEntry({
    organizationId: 'org-1',
    propertyId: 'prop-1',
    category: 'Amenities',
    title: 'Hot Tub',
    description: 'Use the top-left control panel to start the jets.',
    createdAt: new Date('2026-03-18T09:00:00.000Z'),
    updatedAt: new Date('2026-03-18T09:30:00.000Z'),
  });

  assert.equal(entry.scope, 'property');
  assert.equal(entry.propertyId, 'prop-1');
  assert.equal(entry.entryType, 'guidebook');
  assert.equal(entry.topicKey, 'amenities-hot-tub');
  assert.equal(entry.title, 'Hot Tub');
  assert.equal(entry.body, 'Use the top-left control panel to start the jets.');
  assert.deepEqual(entry.channels, ['ai', 'guidebook']);
  assert.equal(entry.status, 'published');
});

void test('generated topic keys are stable and lowercase', () => {
  const first = mapLegacyPropertyFaqToKnowledgeEntry({
    organizationId: 'org-1',
    propertyId: 'prop-1',
    category: 'Wi-Fi / Internet',
    question: 'What is the Wi-Fi password?',
    answer: 'Check the welcome card.',
    analysedAt: new Date('2026-03-18T10:00:00.000Z'),
    updatedAt: new Date('2026-03-18T11:00:00.000Z'),
  });

  const second = mapLegacyPropertyFaqToKnowledgeEntry({
    organizationId: 'org-1',
    propertyId: 'prop-1',
    category: 'Wi-Fi / Internet',
    question: 'How do guests get online?',
    answer: 'Check the welcome card.',
    analysedAt: new Date('2026-03-18T10:00:00.000Z'),
    updatedAt: new Date('2026-03-18T11:00:00.000Z'),
  });

  assert.equal(first.topicKey, 'wi-fi-internet');
  assert.equal(second.topicKey, 'wi-fi-internet');
  assert.equal(first.topicKey, first.topicKey.toLowerCase());
});

void test('unanswered FAQ rows backfill as drafts instead of published knowledge', () => {
  const entry = mapLegacyPropertyFaqToKnowledgeEntry({
    organizationId: 'org-1',
    propertyId: 'prop-1',
    category: 'Check-in',
    question: 'Can I check in early?',
    answer: null,
    analysedAt: new Date('2026-03-18T10:00:00.000Z'),
    updatedAt: new Date('2026-03-18T11:00:00.000Z'),
  });

  assert.equal(entry.status, 'draft');
  assert.equal(entry.answer, null);
});

void test('legacy FAQ and guidebook rows can be backfilled together', () => {
  const payload = buildLegacyKnowledgeBackfillPayloads({
    propertyFaqs: [
      {
        organizationId: 'org-1',
        propertyId: 'prop-1',
        category: 'Parking',
        question: 'Where do I park?',
        answer: 'Use spot 2.',
        analysedAt: new Date('2026-03-18T10:00:00.000Z'),
        updatedAt: new Date('2026-03-18T11:00:00.000Z'),
      },
    ],
    propertyGuidebookEntries: [
      {
        organizationId: 'org-1',
        propertyId: 'prop-1',
        category: 'Arrival',
        title: 'Front Door',
        description: 'The keypad is on the left side of the doorframe.',
        createdAt: new Date('2026-03-18T09:00:00.000Z'),
        updatedAt: new Date('2026-03-18T09:30:00.000Z'),
      },
    ],
  });

  assert.equal(payload.length, 2);
  assert.deepEqual(
    payload.map((entry) => entry.entryType),
    ['faq', 'guidebook'],
  );
});
