import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import { messages, reservations, properties, propertyFaqs, knowledgeEntries, propertyMemory } from '@walt/db';
import { db } from '@/lib/db';

type QuestionCategory = {
  name: string;
  count: number;
  examples: string[];
  suggestedAnswer: string;
};

async function getPropertyKnowledge(propertyId: string): Promise<string> {
  const [entries, memories] = await Promise.all([
    db
      .select({ question: knowledgeEntries.question, answer: knowledgeEntries.answer })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.propertyId, propertyId)),
    db
      .select({ fact: propertyMemory.fact })
      .from(propertyMemory)
      .where(eq(propertyMemory.propertyId, propertyId)),
  ]);

  const parts: string[] = [];
  if (entries.length > 0) {
    parts.push('KNOWN FACTS FROM KNOWLEDGE BASE:');
    for (const e of entries) {
      parts.push(`- Q: ${e.question}\n  A: ${e.answer ?? 'No answer documented'}`);
    }
  }
  if (memories.length > 0) {
    parts.push('\nPROPERTY MEMORY (verified facts):');
    for (const m of memories) {
      parts.push(`- ${m.fact}`);
    }
  }
  if (parts.length === 0) {
    parts.push('NO PROPERTY KNOWLEDGE AVAILABLE — all answers should note that the information needs to be verified with the host.');
  }
  return parts.join('\n');
}

async function analyzePropertyMessages(
  client: OpenAI,
  propertyId: string,
  propertyName: string,
  guestMessages: string[],
): Promise<QuestionCategory[]> {
  if (guestMessages.length === 0) return [];

  const knowledgeContext = await getPropertyKnowledge(propertyId);
  const messageList = guestMessages.map((m, i) => `${i + 1}. ${m}`).join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are analyzing guest messages for the short-term rental property "${propertyName}".

CRITICAL RULES:
- Only include amenities, features, or information that is EXPLICITLY documented in the property knowledge base below.
- Do NOT infer, assume, or fabricate any amenities or features.
- If a guest asks about something not documented in the knowledge base, the suggested answer MUST say: "This isn't documented in our records — please verify with the property manager."
- Never make up plausible-sounding answers about amenities that are not confirmed below.

${knowledgeContext}

TASK:
Identify the most common question categories from the guest messages, count how many messages fall into each,
provide 2-3 example messages per category, and draft a concise suggested host answer for each category.
Base ALL answers strictly on the property knowledge above.

Return valid JSON only: { "categories": [{ "name": string, "count": number, "examples": string[], "suggestedAnswer": string }] }`,
      },
      {
        role: 'user',
        content: `Here are ${guestMessages.length} guest messages for property "${propertyName}":\n\n${messageList}\n\nReturn JSON only.`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as { categories: QuestionCategory[] };
    return parsed.categories ?? [];
  } catch {
    return [];
  }
}

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured.' }, { status: 503 });
  }

  const client = new OpenAI({ apiKey });
  const now = new Date();

  // Load all properties
  const allProperties = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties);
  if (allProperties.length === 0) {
    return NextResponse.json({ error: 'No properties found. Run sync first.' }, { status: 400 });
  }

  // Load all reservations (to map reservationId → propertyId)
  const allReservations = await db
    .select({ id: reservations.id, propertyId: reservations.propertyId })
    .from(reservations);
  const reservationPropertyMap = new Map(allReservations.map((r) => [r.id, r.propertyId]));

  // Load all guest messages
  const guestMessages = await db
    .select({ body: messages.body, reservationId: messages.reservationId })
    .from(messages)
    .where(eq(messages.senderType, 'guest'));

  // Group messages by property
  const messagesByProperty = new Map<string, string[]>();
  for (const msg of guestMessages) {
    const propId = reservationPropertyMap.get(msg.reservationId);
    if (!propId) continue;
    const list = messagesByProperty.get(propId) ?? [];
    list.push(msg.body);
    messagesByProperty.set(propId, list);
  }

  const results: {
    propertyId: string;
    propertyName: string;
    categories: number;
    messages: number;
  }[] = [];

  for (const prop of allProperties) {
    const msgs = messagesByProperty.get(prop.id) ?? [];
    if (msgs.length === 0) continue;

    const categories = await analyzePropertyMessages(client, prop.id, prop.name, msgs);

    for (const cat of categories) {
      await db
        .insert(propertyFaqs)
        .values({
          id: uuidv4(),
          propertyId: prop.id,
          category: cat.name,
          question: cat.name,
          answer: cat.suggestedAnswer,
          examples: cat.examples,
          reviewStatus: 'unreviewed',
          analysedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [propertyFaqs.propertyId, propertyFaqs.category],
          set: {
            question: cat.name,
            answer: cat.suggestedAnswer,
            examples: cat.examples,
            reviewStatus: 'unreviewed',
            analysedAt: now,
            updatedAt: now,
          },
        });
    }

    results.push({
      propertyId: prop.id,
      propertyName: prop.name,
      categories: categories.length,
      messages: msgs.length,
    });
  }

  return NextResponse.json({ ok: true, properties: results, totalMessages: guestMessages.length });
}
