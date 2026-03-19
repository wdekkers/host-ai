import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';

type GuidebookDraft = {
  title: string;
  body: string;
  topicKey: string;
  status?: string;
};

type GuidebookDraftDependencies = {
  generateDraft?: (args: { notes: string; propertyName?: string }) => Promise<GuidebookDraft>;
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

async function generateGuidebookDraftWithOpenAi({
  notes,
  propertyName,
}: {
  notes: string;
  propertyName?: string;
}): Promise<GuidebookDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured.');
  }

  const client = new OpenAI({ apiKey });
  const propertyLine = propertyName ? `Property: ${propertyName}\n` : '';
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You convert rough short-term rental host notes into one clean guidebook entry.

Return JSON only with this exact shape:
{ "title": string, "body": string, "topicKey": string, "status": "draft" | "published" }

Rules:
- Write a short clear title for the guidebook section.
- Write a concise, polished body with the essential guest instructions.
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
    throw new Error('AI did not return a guidebook draft');
  }

  const parsed = JSON.parse(raw) as Partial<GuidebookDraft>;
  if (!parsed.title?.trim() || !parsed.body?.trim()) {
    throw new Error('AI returned an incomplete guidebook draft');
  }

  return {
    title: parsed.title.trim(),
    body: parsed.body.trim(),
    topicKey: normalizeTopicKey(parsed.topicKey?.trim() || parsed.title),
    status: normalizeDraftStatus(parsed.status),
  };
}

export async function handleGenerateGuidebookDraft(
  request: Request,
  { generateDraft = generateGuidebookDraftWithOpenAi }: GuidebookDraftDependencies = {},
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
          title: draft.title.trim(),
          body: draft.body.trim(),
          topicKey: normalizeTopicKey(draft.topicKey || draft.title),
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
    return handleApiError({ error, route: '/api/knowledge/guidebook-draft POST' });
  }
}

export const POST = withPermission('ops.write', async (request: Request) =>
  handleGenerateGuidebookDraft(request),
);
