import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';
import { handleApiError } from '@/lib/secure-logger';
import { messages, reservations } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;
      const body = (await request.json()) as {
        messageId: string;
        chips?: string[];
        extraContext?: string;
      };
      const { messageId, chips, extraContext } = body;

      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      const [message] = await db.select().from(messages).where(eq(messages.id, messageId));

      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const guestName =
        [reservation.guestFirstName, reservation.guestLastName].filter(Boolean).join(' ') ||
        'the guest';

      const organizationId = authContext.orgId;

      const suggestion = await generateReplySuggestion({
        guestName,
        propertyName: reservation.propertyName ?? 'the property',
        propertyId: reservation.propertyId ?? null,
        organizationId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        messageBody: message.body,
        chips,
        extraContext,
      });

      if (!suggestion) {
        return NextResponse.json({ error: 'Could not generate suggestion' }, { status: 503 });
      }

      await db
        .update(messages)
        .set({ suggestion, suggestionGeneratedAt: new Date() })
        .where(eq(messages.id, messageId));

      return NextResponse.json({ suggestion });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/suggest' });
    }
  },
);
