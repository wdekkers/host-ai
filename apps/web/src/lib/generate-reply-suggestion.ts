import OpenAI from 'openai';
import { and, eq, isNull } from 'drizzle-orm';
import type { KnowledgeEntry } from '@walt/contracts';
import { agentConfigs, knowledgeEntries, properties, propertyMemory } from '@walt/db';
import { db } from '@/lib/db';
import {
  formatKnowledgeForPrompt,
  resolveKnowledgeForProperty,
  type KnowledgeEntrySource,
} from './knowledge-resolver';
import { formatPropertyFacts } from './property-facts';
import { SYSTEM_RULES } from './ai/system-rules';

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

export type SuggestionResult =
  | { action: 'draft'; suggestion: string; sourcesUsed: SourceReference[] }
  | { action: 'skip'; reason: string; sourcesUsed: SourceReference[] };

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
  guestScore,
  guestScoreSummary,
  reservationStatus,
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
  guestScore?: number | null;
  guestScoreSummary?: string | null;
  reservationStatus?: string | null;
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

  // --- Property Facts: structured fields from listing ---
  let propertyFactsContext = '';
  if (propertyId) {
    const [propRow] = await db
      .select({
        checkInTime: properties.checkInTime,
        checkOutTime: properties.checkOutTime,
        timezone: properties.timezone,
        maxGuests: properties.maxGuests,
        bedrooms: properties.bedrooms,
        beds: properties.beds,
        bathrooms: properties.bathrooms,
        petsAllowed: properties.petsAllowed,
        smokingAllowed: properties.smokingAllowed,
        eventsAllowed: properties.eventsAllowed,
        amenities: properties.amenities,
        propertyType: properties.propertyType,
        hasPool: properties.hasPool,
        description: properties.description,
        wifiName: properties.wifiName,
        wifiPassword: properties.wifiPassword,
        houseManual: properties.houseManual,
        guestAccess: properties.guestAccess,
        spaceOverview: properties.spaceOverview,
        neighborhoodDescription: properties.neighborhoodDescription,
        gettingAround: properties.gettingAround,
        additionalRules: properties.additionalRules,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (propRow) {
      propertyFactsContext = formatPropertyFacts(propRow);
      if (propertyFactsContext) {
        sourcesUsed.push({
          type: 'property_field',
          id: propertyId,
          label: 'Listing details',
          snippet: propertyFactsContext.slice(0, 120),
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

  const today = new Date();
  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;

  let bookingPhase = 'unknown';
  if (checkInDate && checkOutDate) {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const ciStart = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
    const coStart = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());
    if (todayStart < ciStart) bookingPhase = 'pre-arrival (guest has NOT checked in yet)';
    else if (todayStart >= ciStart && todayStart < coStart) bookingPhase = 'currently hosting (guest is staying at the property RIGHT NOW)';
    else bookingPhase = 'post-checkout (guest has already left)';
  }

  const riskContext = [
    typeof guestScore === 'number' ? `Guest risk score: ${guestScore}/10` : null,
    guestScoreSummary ? `Score reasoning: ${guestScoreSummary}` : null,
    reservationStatus ? `Reservation status: ${reservationStatus}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const decisionRules = `DECISION RULES (apply in order, BEFORE drafting anything):

1. If Reservation status is 'denied', 'declined', or 'cancelled', OR any prior HOST
   message in this conversation clearly declines the booking (e.g. "our decision is
   final", "unable to accommodate", "we will not be hosting", "this won't work"),
   return action=skip. Do NOT draft a reply.

2. If the latest GUEST message is an emotional appeal or plea attempting to reverse
   a prior host decline (guilt-tripping, mentioning children being disappointed,
   pressure about alternatives being booked, repeated "please reconsider"),
   return action=skip.

3. If guest score is <= 4 AND the guest is actively negotiating against a stated
   house rule (pets after no-pets, extra visitors after no-visitors, events after
   no-events), draft ONLY a brief, firm restatement of the policy. Do NOT invite
   further discussion, do NOT apologize, do NOT offer alternatives.

Output MUST be valid JSON, one of:
  {"action": "draft", "text": "<the reply to the guest>"}
  {"action": "skip", "reason": "<1 short sentence for the host explaining why no reply>"}`;

  const systemPrompt = `You are a short-term rental host assistant drafting a reply to a guest.

Today's date: ${today.toLocaleDateString()}
Property: ${propertyName}
Guest full name: ${guestFullName}${guestFirstName ? `\nGuest first name: ${guestFirstName}` : ''}
Check-in: ${formatDate(checkIn)}
Check-out: ${formatDate(checkOut)}
Booking phase: ${bookingPhase}
${riskContext ? `\n${riskContext}\n` : ''}
Tone: ${tone}
Emoji use: ${emojiUse}
Length: ${responseLength}
${specialInstructions ? `Special instructions: ${specialInstructions}` : ''}
${chipLines ? `Style modifiers for this reply:\n${chipLines}` : ''}
${extraContext ? `IMPORTANT additional instructions for this reply (follow these precisely):\n${extraContext}\n` : ''}
${decisionRules}

${SYSTEM_RULES}${propertyFactsContext ? `\n\n${propertyFactsContext}` : ''}${knowledgeContext ? `\n\n${knowledgeContext}` : ''}${memoryContext}`;

  const historyMessages = conversationHistory.map((m) => ({
    role: (m.senderType === 'guest' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body,
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    temperature: temperature ?? undefined,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
  });

  const content = response.choices[0]?.message?.content ?? null;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as { action?: string; text?: string; reason?: string };
    if (parsed.action === 'skip' && typeof parsed.reason === 'string' && parsed.reason.length > 0) {
      return { action: 'skip', reason: parsed.reason, sourcesUsed };
    }
    if (parsed.action === 'draft' && typeof parsed.text === 'string' && parsed.text.length > 0) {
      return { action: 'draft', suggestion: parsed.text, sourcesUsed };
    }
  } catch {
    // Fall through — treat raw content as a draft for backward compatibility.
  }
  return { action: 'draft', suggestion: content, sourcesUsed };
}
