import OpenAI from 'openai';
import { and, eq, isNull } from 'drizzle-orm';
import type { KnowledgeEntry } from '@walt/contracts';
import { agentConfigs, knowledgeEntries, propertyMemory } from '@walt/db';
import { db } from '@/lib/db';
import {
  formatKnowledgeForPrompt,
  resolveKnowledgeForProperty,
  type KnowledgeEntrySource,
} from './knowledge-resolver';

const CHIP_INSTRUCTIONS: Record<string, string> = {
  shorter: 'Keep the reply to 1-2 sentences maximum.',
  no_emoji: 'Do not use any emoji.',
  formal: 'Use a formal, professional tone.',
  friendly: 'Use a warm, very friendly and casual tone.',
  more_detail: 'Provide more detail and explanation in the reply.',
};

export type SourceReference = {
  type: 'knowledge_entry' | 'property_field' | 'property_memory';
  id: string;
  label: string;
  snippet?: string;
};

export type SuggestionResult = {
  suggestion: string;
  sourcesUsed: SourceReference[];
};

export async function generateReplySuggestion({
  guestFirstName,
  guestLastName,
  propertyName,
  propertyId,
  organizationId,
  checkIn,
  checkOut,
  conversationHistory,
  chips,
  extraContext,
  temperature,
}: {
  guestFirstName: string | null;
  guestLastName: string | null;
  propertyName: string;
  propertyId: string | null;
  organizationId: string;
  checkIn: Date | string | null;
  checkOut: Date | string | null;
  conversationHistory: Array<{ body: string; senderType: string }>;
  chips?: string[];
  extraContext?: string;
  temperature?: number;
}): Promise<SuggestionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const formatDate = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString() : 'unknown';

  const toKnowledgeEntry = (row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry => ({
    ...row,
    scope: row.scope as KnowledgeEntry['scope'],
    entryType: row.entryType as KnowledgeEntry['entryType'],
    status: row.status as KnowledgeEntry['status'],
    channels: row.channels as KnowledgeEntry['channels'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  const knowledgeSource: KnowledgeEntrySource = {
    listKnowledgeEntries: async ({ organizationId: sourceOrganizationId, scope, propertyId }) => {
      const conditions = [
        eq(knowledgeEntries.organizationId, sourceOrganizationId),
        eq(knowledgeEntries.scope, scope),
      ];

      if (scope === 'property' && propertyId) {
        conditions.push(eq(knowledgeEntries.propertyId, propertyId));
      }

      if (scope === 'global') {
        conditions.push(isNull(knowledgeEntries.propertyId));
      }

      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(and(...conditions));
      return rows.map(toKnowledgeEntry);
    },
  };

  const aiKnowledge = await resolveKnowledgeForProperty({
    source: knowledgeSource,
    organizationId,
    propertyId,
    channels: ['ai'],
  });
  const knowledgeContext = formatKnowledgeForPrompt(aiKnowledge);

  const sourcesUsed: SourceReference[] = aiKnowledge.map((entry) => ({
    type: 'knowledge_entry' as const,
    id: entry.id,
    label: entry.question ?? entry.answer?.slice(0, 60) ?? 'Knowledge entry',
    snippet: entry.answer?.slice(0, 120),
  }));

  // --- Knowledge: Learned Memory ---
  let memoryContext = '';
  if (propertyId) {
    const facts = await db
      .select({ id: propertyMemory.id, fact: propertyMemory.fact })
      .from(propertyMemory)
      .where(eq(propertyMemory.propertyId, propertyId))
      .limit(20);
    if (facts.length > 0) {
      memoryContext = `\n\nProperty facts (learned):\n${facts.map((f) => `- ${f.fact}`).join('\n')}`;
      for (const f of facts) {
        sourcesUsed.push({
          type: 'property_memory',
          id: f.id,
          label: f.fact.slice(0, 60),
          snippet: f.fact.slice(0, 120),
        });
      }
    }
  }

  // --- Agent Config: global then property override ---
  let tone = 'warm and friendly';
  let emojiUse = 'light (1-2 emoji max)';
  let responseLength = 'balanced (2-3 sentences)';
  let specialInstructions = '';

  const globalConfig = await db
    .select()
    .from(agentConfigs)
    .where(and(eq(agentConfigs.organizationId, organizationId), eq(agentConfigs.scope, 'global')))
    .limit(1);

  if (globalConfig[0]) {
    if (globalConfig[0].tone) tone = globalConfig[0].tone;
    if (globalConfig[0].emojiUse) emojiUse = globalConfig[0].emojiUse;
    if (globalConfig[0].responseLength) responseLength = globalConfig[0].responseLength;
    if (globalConfig[0].specialInstructions)
      specialInstructions = globalConfig[0].specialInstructions;
  }

  if (propertyId) {
    const propConfig = await db
      .select()
      .from(agentConfigs)
      .where(
        and(
          eq(agentConfigs.organizationId, organizationId),
          eq(agentConfigs.scope, 'property'),
          eq(agentConfigs.propertyId, propertyId),
        ),
      )
      .limit(1);

    if (propConfig[0]) {
      if (propConfig[0].tone) tone = propConfig[0].tone;
      if (propConfig[0].emojiUse) emojiUse = propConfig[0].emojiUse;
      if (propConfig[0].responseLength) responseLength = propConfig[0].responseLength;
      if (propConfig[0].specialInstructions)
        specialInstructions = propConfig[0].specialInstructions;
    }
  }

  // --- Chips → style instructions ---
  const chipLines = (chips ?? [])
    .map((c) => CHIP_INSTRUCTIONS[c])
    .filter(Boolean)
    .join('\n');

  const guestFullName = [guestFirstName, guestLastName].filter(Boolean).join(' ') || 'the guest';

  const systemPrompt = `You are a short-term rental host assistant drafting a reply to a guest.

Property: ${propertyName}
Guest full name: ${guestFullName}${guestFirstName ? `\nGuest first name: ${guestFirstName}` : ''}
Check-in: ${formatDate(checkIn)}
Check-out: ${formatDate(checkOut)}

Tone: ${tone}
Emoji use: ${emojiUse}
Length: ${responseLength}
${specialInstructions ? `Special instructions: ${specialInstructions}` : ''}
${chipLines ? `Style modifiers for this reply:\n${chipLines}` : ''}
${extraContext ? `IMPORTANT additional instructions for this reply (follow these precisely):\n${extraContext}\n` : ''}
Reply in the same language as the guest message. Do not start with "Of course" or "Certainly".${knowledgeContext ? `\n\n${knowledgeContext}` : ''}${memoryContext}`;

  const historyMessages = conversationHistory.map((m) => ({
    role: (m.senderType === 'guest' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body,
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    temperature: temperature ?? undefined,
    messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
  });

  const content = response.choices[0]?.message?.content ?? null;
  if (!content) return null;
  return { suggestion: content, sourcesUsed };
}
