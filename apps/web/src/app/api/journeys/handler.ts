import { and, desc, eq } from 'drizzle-orm';
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
        .select()
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
