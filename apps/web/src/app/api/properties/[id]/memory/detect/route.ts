import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';

type Fact = { text: string; type: 'property_fact' | 'situational' };

type Params = { params: Promise<{ id: string }> };

export const POST = withPermission('properties.read', async (request: Request, _context: Params) => {
  void _context;
  try {
    const body = (await request.json()) as {
      hintText?: string;
      chips: string[];
      reservationId: string;
    };
    const hintText = body.hintText;

    // Chips alone contain no learnable facts — skip LLM call
    if (!hintText?.trim()) {
      return NextResponse.json({ facts: [] });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ facts: [] });

    const client = new OpenAI({ apiKey });

    const prompt = `You are classifying host hints about a vacation rental property.

Given the following hint text provided by a host when sending a message to a guest, extract individual facts and classify each as:
- "property_fact": a standing truth about the property that would be useful in future replies (e.g. "pool takes 24-48 hours to heat", "parking is in the garage")
- "situational": context specific only to this moment that should not be remembered (e.g. "it's warm today", "the guest mentioned it earlier")

Hint text: "${hintText.trim()}"

Return a JSON object with this exact shape: { "facts": [{ "text": "...", "type": "property_fact" | "situational" }] }
Return only the JSON object, no other text.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{"facts":[]}';
    let facts: Fact[] = [];
    try {
      const parsed = JSON.parse(raw) as { facts?: Fact[] } | Fact[];
      facts = Array.isArray(parsed) ? parsed : (parsed.facts ?? []);
    } catch {
      facts = [];
    }

    return NextResponse.json({ facts });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/memory/detect' });
  }
});
