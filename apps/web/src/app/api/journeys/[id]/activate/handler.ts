import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { journeys } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

export const handleActivateJourney = withPermission(
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
        .set({ status: 'active', updatedBy: authContext.userId, updatedAt: new Date() })
        .where(and(eq(journeys.id, id), eq(journeys.organizationId, authContext.orgId)));

      return NextResponse.json({ success: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys/[id]/activate POST' });
    }
  },
);
