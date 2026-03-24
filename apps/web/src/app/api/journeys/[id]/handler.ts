import { and, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { approvalModeSchema, coverageScheduleSchema, journeyStepSchema } from '@walt/contracts';
import { journeyExecutionLog, journeys } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

const updateJourneySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  steps: z.array(journeyStepSchema).min(1).optional(),
  coverageSchedule: coverageScheduleSchema.nullable().optional(),
  approvalMode: approvalModeSchema.optional(),
});

export const handleGetJourney = withPermission(
  'journeys.read',
  async (_request: Request, { params }: Params, authContext) => {
    try {
      const { id } = await params;

      const [row] = await db
        .select()
        .from(journeys)
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)))
        .limit(1);

      if (!row) {
        return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
      }

      let promotionSuggested = false;
      if (row.approvalMode === 'draft') {
        const [stats] = await db
          .select({ total: count() })
          .from(journeyExecutionLog)
          .where(and(
            eq(journeyExecutionLog.journeyId, row.id),
            sql`action IN ('message_drafted', 'message_sent')`,
          ));
        if ((stats?.total ?? 0) > 50) {
          promotionSuggested = true;
        }
      }

      return NextResponse.json({ ...row, promotionSuggested });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/[id] GET' });
    }
  },
);

export const handleUpdateJourney = withPermission(
  'journeys.write',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { id } = await params;

      const body = await request.json().catch(() => ({}));
      const parsed = updateJourneySchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(journeys)
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
      }

      const now = new Date();
      const [updated] = await db
        .update(journeys)
        .set({
          ...parsed.data,
          version: existing.version + 1,
          updatedBy: authContext.userId,
          updatedAt: now,
        })
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)))
        .returning();

      return NextResponse.json(updated);
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/[id] PUT' });
    }
  },
);

export const handleDeleteJourney = withPermission(
  'journeys.write',
  async (_request: Request, { params }: Params, authContext) => {
    try {
      const { id } = await params;

      const [existing] = await db
        .select()
        .from(journeys)
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
      }

      await db
        .update(journeys)
        .set({ status: 'archived', updatedBy: authContext.userId, updatedAt: new Date() })
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)));

      return NextResponse.json({ success: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/[id] DELETE' });
    }
  },
);
