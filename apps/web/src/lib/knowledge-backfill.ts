import { type knowledgeEntries } from '@walt/db';

type KnowledgeEntryInsert = Omit<typeof knowledgeEntries.$inferInsert, 'id'>;

export type LegacyPropertyFaqInput = {
  organizationId: string;
  propertyId: string;
  category: string;
  question: string;
  answer: string | null;
  analysedAt: Date;
  updatedAt: Date;
};

export type LegacyPropertyGuidebookEntryInput = {
  organizationId: string;
  propertyId: string;
  category: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export function normalizeLegacyKnowledgeTopicKey(...parts: Array<string | null | undefined>) {
  const normalized = parts
    .map((part) => part?.trim().toLowerCase() ?? '')
    .filter(Boolean)
    .join(' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'untitled';
}

export function mapLegacyPropertyFaqToKnowledgeEntry(
  faq: LegacyPropertyFaqInput,
): KnowledgeEntryInsert {
  const answer = faq.answer?.trim() ? faq.answer.trim() : null;

  return {
    organizationId: faq.organizationId,
    scope: 'property',
    propertyId: faq.propertyId,
    entryType: 'faq',
    topicKey: normalizeLegacyKnowledgeTopicKey(faq.category),
    title: null,
    question: faq.question,
    answer,
    body: null,
    channels: ['ai', 'website'],
    status: answer ? 'published' : 'draft',
    sortOrder: 0,
    slug: normalizeLegacyKnowledgeTopicKey(faq.category),
    createdAt: faq.analysedAt,
    updatedAt: faq.updatedAt,
  };
}

export function mapLegacyPropertyGuidebookEntryToKnowledgeEntry(
  entry: LegacyPropertyGuidebookEntryInput,
): KnowledgeEntryInsert {
  return {
    organizationId: entry.organizationId,
    scope: 'property',
    propertyId: entry.propertyId,
    entryType: 'guidebook',
    topicKey: normalizeLegacyKnowledgeTopicKey(entry.category, entry.title),
    title: entry.title,
    question: null,
    answer: null,
    body: entry.description,
    channels: ['ai', 'guidebook'],
    status: 'published',
    sortOrder: 0,
    slug: normalizeLegacyKnowledgeTopicKey(entry.title),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function buildLegacyKnowledgeBackfillPayloads({
  propertyFaqs,
  propertyGuidebookEntries,
}: {
  propertyFaqs: LegacyPropertyFaqInput[];
  propertyGuidebookEntries: LegacyPropertyGuidebookEntryInput[];
}): KnowledgeEntryInsert[] {
  return [
    ...propertyFaqs.map(mapLegacyPropertyFaqToKnowledgeEntry),
    ...propertyGuidebookEntries.map(mapLegacyPropertyGuidebookEntryToKnowledgeEntry),
  ];
}
