import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { journeyEnrollments, journeyExclusions, journeys } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

const excludeSchema = z.object({
  reservationId: z.string().min(1),
});

export const handleExcludeReservation = withPermission(
  'journeys.write',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { id } = await params;

      const body = await request.json().catch(() => ({}));
      const parsed = excludeSchema.safeParse(body);

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

      const { reservationId } = parsed.data;

      // Insert exclusion (unique constraint handles duplicates)
      await db
        .insert(journeyExclusions)
        .values({
          id: randomUUID(),
          journeyId: id,
          reservationId,
          organizationId: authContext.orgId,
          excludedBy: authContext.userId,
          excludedAt: new Date(),
        })
        .onConflictDoNothing();

      // Cancel active enrollment for this journey + reservation if it exists
      await db
        .update(journeyEnrollments)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(journeyEnrollments.journeyId, id),
            eq(journeyEnrollments.reservationId, reservationId),
            eq(journeyEnrollments.status, 'active'),
          ),
        );

      return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/[id]/exclude POST' });
    }
  },
);
