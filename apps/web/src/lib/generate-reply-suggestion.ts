import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import { propertyFaqs } from '@walt/db';
import { db } from '@/lib/db';

export async function generateReplySuggestion({
  guestName,
  propertyName,
  propertyId,
  checkIn,
  checkOut,
  messageBody,
}: {
  guestName: string;
  propertyName: string;
  propertyId: string | null;
  checkIn: Date | string | null;
  checkOut: Date | string | null;
  messageBody: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  const formatDate = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString() : 'unknown';

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
    if (faqLines) faqContext = `\n\nKnowledge base for this property:\n${faqLines}`;
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `You are a helpful short-term rental host assistant. Draft a warm, concise reply to a guest message.
Property: ${propertyName}
Guest: ${guestName}
Check-in: ${formatDate(checkIn)}
Check-out: ${formatDate(checkOut)}
Reply in the same language as the guest message. Keep it under 3 sentences unless the question requires more detail.${faqContext}`,
      },
      { role: 'user', content: messageBody },
    ],
  });

  return response.choices[0]?.message?.content ?? null;
}
