import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';
import { handleApiError } from '@/lib/secure-logger';
import { messages, reservations } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'inbox.read',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;
      const body = (await request.json()) as {
        messageId: string;
        chips?: string[];
        extraContext?: string;
      };
      const { messageId, chips, extraContext } = body;

      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
      }

      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      const thread = await db
        .select({ id: messages.id, body: messages.body, senderType: messages.senderType })
        .from(messages)
        .where(eq(messages.reservationId, reservationId))
        .orderBy(asc(messages.createdAt));

      if (thread.length === 0) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const organizationId = authContext.orgId;

      const suggestion = await generateReplySuggestion({
        guestFirstName: reservation.guestFirstName ?? null,
        guestLastName: reservation.guestLastName ?? null,
        propertyName: reservation.propertyName ?? 'the property',
        propertyId: reservation.propertyId ?? null,
        organizationId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        conversationHistory: thread,
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
