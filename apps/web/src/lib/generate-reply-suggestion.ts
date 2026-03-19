import OpenAI from 'openai';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { propertyFaqs, propertyGuidebookEntries, propertyMemory, agentConfigs } from '@walt/db';
import { db } from '@/lib/db';

const CHIP_INSTRUCTIONS: Record<string, string> = {
  shorter: 'Keep the reply to 1-2 sentences maximum.',
  no_emoji: 'Do not use any emoji.',
  formal: 'Use a formal, professional tone.',
  friendly: 'Use a warm, very friendly and casual tone.',
  more_detail: 'Provide more detail and explanation in the reply.',
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
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const formatDate = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString() : 'unknown';

  // --- Knowledge: FAQ ---
  let faqContext = '';
  if (propertyId) {
    const faqs = await db
      .select({ category: propertyFaqs.category, answer: propertyFaqs.answer })
      .from(propertyFaqs)
      .where(eq(propertyFaqs.propertyId, propertyId));
    const faqLines = faqs
      .filter((f) => f.answer)
      .map((f) => `Q: ${f.category}\nA: ${f.answer}`)
      .join('\n\n');
    if (faqLines) faqContext = `\n\nFAQ:\n${faqLines}`;
  }

  // --- Knowledge: Guidebook (keyword match against latest guest message) ---
  const latestGuestMessage =
    [...conversationHistory].reverse().find((m) => m.senderType === 'guest')?.body ?? '';
  let guidebookContext = '';
  if (propertyId) {
    const words = latestGuestMessage
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    if (words.length > 0) {
      const conditions = words.map((w) =>
        or(
          ilike(propertyGuidebookEntries.title, `%${w}%`),
          ilike(propertyGuidebookEntries.description, `%${w}%`),
        ),
      );
      const entries = await db
        .select({
          title: propertyGuidebookEntries.title,
          description: propertyGuidebookEntries.description,
          mediaUrl: propertyGuidebookEntries.mediaUrl,
          id: propertyGuidebookEntries.id,
        })
        .from(propertyGuidebookEntries)
        .where(and(eq(propertyGuidebookEntries.propertyId, propertyId), or(...conditions)))
        .limit(3);

      if (entries.length > 0) {
        const lines = entries
          .map(
            (e) =>
              `[${e.title}]: ${e.description}${e.mediaUrl ? ` (Video/link: ${e.mediaUrl})` : ''}`,
          )
          .join('\n\n');
        guidebookContext = `\n\nGuidebook entries for this property:\n${lines}`;

        // Increment ai_use_count for matched entries
        await Promise.all(
          entries.map((e) =>
            db
              .update(propertyGuidebookEntries)
              .set({
                aiUseCount: sql`${propertyGuidebookEntries.aiUseCount} + 1`,
                lastUsedAt: new Date(),
              })
              .where(eq(propertyGuidebookEntries.id, e.id)),
          ),
        );
      }
    }
  }

  // --- Knowledge: Learned Memory ---
  let memoryContext = '';
  if (propertyId) {
    const facts = await db
      .select({ fact: propertyMemory.fact })
      .from(propertyMemory)
      .where(eq(propertyMemory.propertyId, propertyId))
      .limit(20);
    if (facts.length > 0) {
      memoryContext = `\n\nProperty facts (learned):\n${facts.map((f) => `- ${f.fact}`).join('\n')}`;
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
Reply in the same language as the guest message. Do not start with "Of course" or "Certainly".${faqContext}${guidebookContext}${memoryContext}`;

  const historyMessages = conversationHistory.map((m) => ({
    role: (m.senderType === 'guest' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body,
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
  });

  return response.choices[0]?.message?.content ?? null;
}
