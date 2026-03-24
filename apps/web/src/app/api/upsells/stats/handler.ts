import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { upsellEvents } from '@walt/db';

export const handleUpsellStats = withPermission(
  'upsells.read',
  async (_request: Request, _context: unknown, authContext) => {
    try {
      const [stats] = await db
        .select({
          totalOffered: sql<number>`count(*)::int`,
          totalAccepted: sql<number>`count(*) filter (where ${upsellEvents.status} = 'accepted')::int`,
          totalDeclined: sql<number>`count(*) filter (where ${upsellEvents.status} = 'declined')::int`,
          estimatedRevenueOffered: sql<number>`coalesce(sum(${upsellEvents.estimatedRevenue}), 0)::int`,
          actualRevenueAccepted: sql<number>`coalesce(sum(${upsellEvents.actualRevenue}) filter (where ${upsellEvents.status} = 'accepted'), 0)::int`,
        })
        .from(upsellEvents)
        .where(eq(upsellEvents.organizationId, authContext.orgId));

      return NextResponse.json(stats ?? {
        totalOffered: 0,
        totalAccepted: 0,
        totalDeclined: 0,
        estimatedRevenueOffered: 0,
        actualRevenueAccepted: 0,
      });
    } catch (error) {
      return handleApiError({ error, route: '/api/upsells/stats GET' });
    }
  },
);
