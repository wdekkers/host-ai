import { and, desc, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { messages, reservations } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const GET = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params) => {
    try {
      const { reservationId } = await params;
      const url = new URL(request.url);
      const before = url.searchParams.get('before');
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

      const conditions = [eq(messages.reservationId, reservationId)];
      if (before) {
        conditions.push(lt(messages.createdAt, new Date(before)));
      }

      const [rows, reservationRows] = await Promise.all([
        db
          .select()
          .from(messages)
          .where(and(...conditions))
          .orderBy(desc(messages.createdAt))
          .limit(limit + 1),
        db
          .select({
            guestFirstName: reservations.guestFirstName,
            guestLastName: reservations.guestLastName,
            propertyName: reservations.propertyName,
            propertyId: reservations.propertyId,
            checkIn: reservations.checkIn,
            checkOut: reservations.checkOut,
            platform: reservations.platform,
          })
          .from(reservations)
          .where(eq(reservations.id, reservationId))
          .limit(1),
      ]);

      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit).reverse();

      const reservationRow = reservationRows[0] ?? null;
      const reservation = reservationRow
        ? {
            guestFirstName: reservationRow.guestFirstName,
            guestLastName: reservationRow.guestLastName,
            propertyName: reservationRow.propertyName,
            propertyId: reservationRow.propertyId,
            checkIn: reservationRow.checkIn?.toISOString() ?? null,
            checkOut: reservationRow.checkOut?.toISOString() ?? null,
            platform: reservationRow.platform,
          }
        : null;

      return NextResponse.json({ messages: items, hasMore, reservation });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/messages' });
    }
  },
);
