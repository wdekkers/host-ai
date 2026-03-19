import Anthropic from '@anthropic-ai/sdk';

export type MessageContext = {
  body: string;
  guestFirstName: string;
  propertyName: string;
  arrivalDate: string; // YYYY-MM-DD
};

export type SuggestedTask = {
  title: string;
  description: string;
};

type ClassifyDeps = {
  callAi?: (prompt: string) => Promise<string>;
};

const SYSTEM_PROMPT = `You are a property management assistant. Given a guest message, decide if a host action is needed.

Actionable signals: pool/spa/hot-tub requests, early check-in, late check-out, extra supplies (towels, cribs, etc.), special occasions.

Respond ONLY with JSON in this format:
- If action needed: {"hasSuggestedTask": true, "title": "...", "description": "..."}
- If no action: {"hasSuggestedTask": false}

Keep title concise (under 60 chars). Include the guest name and property in the title.`;

async function defaultCallAi(prompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (block?.type !== 'text') throw new Error('Unexpected AI response type');
  return block.text;
}

export async function classifyMessage(
  context: MessageContext,
  deps: ClassifyDeps = {},
): Promise<SuggestedTask | null> {
  const callAi = deps.callAi ?? defaultCallAi;

  const prompt = `Property: ${context.propertyName}
Guest first name: ${context.guestFirstName}
Arrival date: ${context.arrivalDate}
Message: "${context.body}"`;

  const raw = await callAi(prompt);

  let parsed: { hasSuggestedTask: boolean; title?: string; description?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }

  if (!parsed.hasSuggestedTask || !parsed.title) return null;
  return { title: parsed.title, description: parsed.description ?? '' };
}
