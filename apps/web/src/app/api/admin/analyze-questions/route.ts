import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import { messages } from '@walt/db';
import { db } from '@/lib/db';

type QuestionCategory = {
  name: string;
  count: number;
  examples: string[];
  suggestedAnswer: string;
};

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured.' }, { status: 503 });
  }

  const inboundMessages = await db
    .select({ body: messages.body })
    .from(messages)
    .where(eq(messages.senderType, 'guest'));

  if (inboundMessages.length === 0) {
    return NextResponse.json({ categories: [] });
  }

  const messageList = inboundMessages.map((m, i) => `${i + 1}. ${m.body}`).join('\n');

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are analyzing guest messages for a short-term rental host.
Identify the most common question categories, count how many messages fall into each,
provide 2-3 example messages per category, and draft a suggested host answer for each.
Return valid JSON only: { "categories": [{ "name": string, "count": number, "examples": string[], "suggestedAnswer": string }] }`
      },
      {
        role: 'user',
        content: `Here are ${inboundMessages.length} guest messages:\n\n${messageList}\n\nReturn JSON only.`
      }
    ]
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    return NextResponse.json({ error: 'Unexpected OpenAI response' }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(text) as { categories: QuestionCategory[] };
    return NextResponse.json({ categories: parsed.categories, totalMessages: inboundMessages.length });
  } catch {
    return NextResponse.json({ error: 'Failed to parse OpenAI response', raw: text }, { status: 502 });
  }
}
