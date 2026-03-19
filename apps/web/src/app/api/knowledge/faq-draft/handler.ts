import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { handleApiError } from '@/lib/secure-logger';

type FaqDraft = {
  question: string;
  answer: string;
  topicKey: string;
  status?: string;
};

type FaqDraftDependencies = {
  generateDraft?: (args: { notes: string; propertyName?: string }) => Promise<FaqDraft>;
};

function normalizeTopicKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeDraftStatus(value: string | undefined) {
  return value === 'published' ? 'published' : 'draft';
}

async function generateFaqDraftWithOpenAi({
  notes,
  propertyName,
}: {
  notes: string;
  propertyName?: string;
}): Promise<FaqDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured.');
  }

  const client = new OpenAI({ apiKey });
  const propertyLine = propertyName ? `Property: ${propertyName}\n` : '';
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You convert rough short-term rental host notes into one clean FAQ entry.

Return JSON only with this exact shape:
{ "question": string, "answer": string, "topicKey": string, "status": "draft" | "published" }

Rules:
- Write a single clear guest-facing FAQ question.
- Write a concise but complete answer in plain language.
- topicKey should be short, lowercase, and stable for this topic.
- Use "published" only when the notes are specific and ready for guests. Use "draft" when the notes are tentative, incomplete, or need review.
- Do not include markdown, commentary, or extra fields.`,
      },
      {
        role: 'user',
        content: `${propertyLine}Notes:\n${notes.trim()}\n\nReturn JSON only.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('AI did not return a FAQ draft');
  }

  const parsed = JSON.parse(raw) as Partial<FaqDraft>;
  if (!parsed.question?.trim() || !parsed.answer?.trim()) {
    throw new Error('AI returned an incomplete FAQ draft');
  }

  return {
    question: parsed.question.trim(),
    answer: parsed.answer.trim(),
    topicKey: normalizeTopicKey(parsed.topicKey?.trim() || parsed.question),
    status: normalizeDraftStatus(parsed.status),
  };
}

export async function handleGenerateFaqDraft(
  request: Request,
  { generateDraft = generateFaqDraftWithOpenAi }: FaqDraftDependencies = {},
) {
  try {
    const body = (await request.json()) as { notes?: string; propertyName?: string };
    const notes = body.notes?.trim();

    if (!notes) {
      return NextResponse.json({ error: 'notes are required' }, { status: 400 });
    }

    try {
      const draft = await generateDraft({
        notes,
        propertyName: body.propertyName?.trim() || undefined,
      });

      return NextResponse.json({
        draft: {
          question: draft.question.trim(),
          answer: draft.answer.trim(),
          topicKey: normalizeTopicKey(draft.topicKey || draft.question),
          status: normalizeDraftStatus(draft.status),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'OPENAI_API_KEY not configured.') {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }

      throw error;
    }
  } catch (error) {
    return handleApiError({ error, route: '/api/knowledge/faq-draft POST' });
  }
}
