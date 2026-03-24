import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize.js';
import { db } from '@/lib/db.js';
import { handleApiError } from '@/lib/secure-logger.js';
import { reservations, upsellEvents } from '@walt/db';

export const handleListUpsells = withPermission(
  'upsells.read',
  async (request: Request, _context: unknown, authContext) => {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const propertyId = url.searchParams.get('propertyId');
      const type = url.searchParams.get('type');

      const conditions = [eq(upsellEvents.organizationId, authContext.orgId)];

      if (status) {
        conditions.push(eq(upsellEvents.status, status));
      }

      if (propertyId) {
        conditions.push(eq(upsellEvents.propertyId, propertyId));
      }

      if (type) {
        conditions.push(eq(upsellEvents.upsellType, type));
      }

      const rows = await db
        .select({
          id: upsellEvents.id,
          organizationId: upsellEvents.organizationId,
          propertyId: upsellEvents.propertyId,
          reservationId: upsellEvents.reservationId,
          journeyId: upsellEvents.journeyId,
          upsellType: upsellEvents.upsellType,
          status: upsellEvents.status,
          messageId: upsellEvents.messageId,
          offeredAt: upsellEvents.offeredAt,
          respondedAt: upsellEvents.respondedAt,
          estimatedRevenue: upsellEvents.estimatedRevenue,
          actualRevenue: upsellEvents.actualRevenue,
          guestFirstName: reservations.guestFirstName,
          guestLastName: reservations.guestLastName,
          propertyName: reservations.propertyName,
        })
        .from(upsellEvents)
        .leftJoin(reservations, eq(upsellEvents.reservationId, reservations.id))
        .where(and(...conditions))
        .orderBy(desc(upsellEvents.offeredAt))
        .limit(50);

      return NextResponse.json(rows);
    } catch (error) {
      return handleApiError({ error, route: '/api/upsells GET' });
    }
  },
);
