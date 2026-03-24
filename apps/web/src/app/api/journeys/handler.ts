import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { journeys } from '@walt/db';

export const handleListJourneys = withPermission(
  'journeys.read',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');

      const conditions = [eq(journeys.organizationId, authContext.orgId)];

      if (status) {
        conditions.push(eq(journeys.status, status));
      }

      const rows = await db
        .select({
          ...getTableColumns(journeys),
          enrollmentCount: sql<number>`(SELECT count(*) FROM walt.journey_enrollments WHERE journey_id = ${journeys.id} AND status = 'active')`.as('enrollment_count'),
          messageCount: sql<number>`(SELECT count(*) FROM walt.journey_execution_log WHERE journey_id = ${journeys.id} AND action IN ('message_drafted', 'message_sent'))`.as('message_count'),
        })
        .from(journeys)
        .where(and(...conditions))
        .orderBy(desc(journeys.createdAt))
        .limit(50);

      return NextResponse.json(rows);
    } catch (error) {
      return handleApiError({ error, route: '/api/journeys GET' });
    }
  },
);
