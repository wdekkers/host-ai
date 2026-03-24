import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { upsellEvents } from '@walt/db';

export const handleUpsellStats = withPermission(
  'upsells.read',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const url = new URL(request.url);
      const propertyId = url.searchParams.get('propertyId');
      const month = url.searchParams.get('month'); // YYYY-MM

      const conditions = [eq(upsellEvents.organizationId, authContext.orgId)];

      if (propertyId && propertyId !== 'all') {
        conditions.push(eq(upsellEvents.propertyId, propertyId));
      }

      if (month) {
        const start = new Date(`${month}-01T00:00:00Z`);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        conditions.push(gte(upsellEvents.offeredAt, start));
        conditions.push(lt(upsellEvents.offeredAt, end));
      }

      const [stats] = await db
        .select({
          totalOffered: sql<number>`count(*)::int`,
          totalAccepted: sql<number>`count(*) filter (where ${upsellEvents.status} = 'accepted')::int`,
          totalDeclined: sql<number>`count(*) filter (where ${upsellEvents.status} = 'declined')::int`,
          estimatedRevenueOffered: sql<number>`coalesce(sum(${upsellEvents.estimatedRevenue}), 0)::int`,
          actualRevenueAccepted: sql<number>`coalesce(sum(${upsellEvents.actualRevenue}) filter (where ${upsellEvents.status} = 'accepted'), 0)::int`,
        })
        .from(upsellEvents)
        .where(and(...conditions));

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
