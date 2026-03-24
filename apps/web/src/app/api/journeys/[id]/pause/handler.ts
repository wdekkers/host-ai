import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { journeyEnrollments, journeys } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const handlePauseJourney = withPermission(
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

      const now = new Date();

      // Cancel all active enrollments for this journey
      await db
        .update(journeyEnrollments)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(journeyEnrollments.journeyId, id),
            eq(journeyEnrollments.status, 'active'),
          ),
        );

      // Set journey status to paused
      await db
        .update(journeys)
        .set({ status: 'paused', updatedBy: authContext.userId, updatedAt: now })
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)));

      return NextResponse.json({ success: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/[id]/pause POST' });
    }
  },
);
