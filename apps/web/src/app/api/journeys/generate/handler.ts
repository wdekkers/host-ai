import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { generateJourneyFromPrompt } from '@/lib/journeys/generate-journey.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { generateJourneyInputSchema } from '@walt/contracts';
import { journeys, properties } from '@walt/db';

async function resolvePropertyContext(_orgId: string, propertyIds: string[]): Promise<string> {
  if (propertyIds.length === 0) return '';

  const rows = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(inArray(properties.id, propertyIds));

  if (rows.length === 0) return '';

  const names = rows.map((r) => `- ${r.name} (id: ${r.id})`).join('\n');
  return `Properties:\n${names}`;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? '';
}

export const handleGenerateJourney = withPermission(
  'journeys.write',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = generateJourneyInputSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }

      const result = await generateJourneyFromPrompt(
        {
          prompt: parsed.data.prompt,
          propertyIds: parsed.data.propertyIds,
          organizationId: authContext.orgId,
        },
        {
          resolvePropertyContext,
          callAI,
        },
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 422 });
      }

      const { journey, considerations } = result;
      const now = new Date();
      const id = randomUUID();

      await db.insert(journeys).values({
        id,
        organizationId: authContext.orgId,
        name: journey.name,
        description: journey.description ?? '',
        status: 'draft',
        propertyIds: parsed.data.propertyIds,
        triggerType: journey.triggerType,
        triggerConfig: journey.triggerConfig,
        steps: journey.steps,
        coverageSchedule: journey.coverageSchedule ?? null,
        approvalMode: journey.approvalMode,
        version: 1,
        prompt: parsed.data.prompt,
        createdBy: authContext.userId,
        updatedBy: authContext.userId,
        createdAt: now,
        updatedAt: now,
      });

      const [created] = await db
        .select()
        .from(journeys)
        .where(eq(journeys.id, id))
        .limit(1);

      return NextResponse.json({ journey: created, considerations }, { status: 201 });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/generate POST' });
    }
  },
);
