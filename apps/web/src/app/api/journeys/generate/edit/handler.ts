import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { editJourneyInputSchema, journeyDefinitionSchema } from '@walt/contracts';
import { journeys } from '@walt/db';

const EDIT_SYSTEM_PROMPT = `You are a journey automation designer for short-term rental hosts. You will be given an existing journey definition and a user instruction. Modify the journey according to the instruction and return ONLY the updated journey as valid JSON — no markdown, no code fences, no explanation text.

The journey must conform to this structure:
{
  "name": "string",
  "description": "string (optional)",
  "triggerType": "one of: booking_confirmed, check_in_approaching, check_in, check_out_approaching, check_out, message_received, gap_detected, sentiment_changed, booking_cancelled, manual",
  "triggerConfig": {},
  "steps": [{ "type": "step_type", "directive": "string or object" }],
  "coverageSchedule": null or { "timezone": "string", "windows": [{ "days": [...], "startHour": number, "endHour": number }] },
  "approvalMode": "draft" | "auto_with_exceptions" | "autonomous"
}`;

export const handleEditJourney = withPermission(
  'journeys.write',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = editJourneyInputSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(journeys)
        .where(
          and(
            eq(journeys.id, parsed.data.journeyId),
            eq(journeys.organizationId, authContext.orgId),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
      }

      const currentJourneyJson = JSON.stringify({
        name: existing.name,
        description: existing.description,
        triggerType: existing.triggerType,
        triggerConfig: existing.triggerConfig,
        steps: existing.steps,
        coverageSchedule: existing.coverageSchedule,
        approvalMode: existing.approvalMode,
      });

      const userPrompt = `Current journey:\n${currentJourneyJson}\n\nInstruction: ${parsed.data.instruction}`;

      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EDIT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });

      const rawContent = response.choices[0]?.message?.content ?? '';

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 422 });
      }

      const validation = journeyDefinitionSchema.safeParse(parsedJson);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.message }, { status: 422 });
      }

      return NextResponse.json({ journey: validation.data });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/generate/edit POST' });
    }
  },
);
