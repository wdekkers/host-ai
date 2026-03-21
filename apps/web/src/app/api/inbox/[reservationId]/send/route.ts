import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { reservations, messages } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'inbox.create',
  async (request: Request, { params }: Params) => {
    try {
      const { reservationId } = await params;
      const { suggestion } = (await request.json()) as { suggestion: string };

      if (!suggestion?.trim()) {
        return NextResponse.json({ error: 'suggestion is required' }, { status: 400 });
      }

      const [reservation] = await db
        .select({ id: reservations.id })
        .from(reservations)
        .where(eq(reservations.id, reservationId));

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      await db.insert(messages).values({
        id: uuidv4(),
        reservationId,
        platform: null,
        body: suggestion.trim(),
        senderType: 'host',
        senderFullName: null,
        createdAt: new Date(),
        suggestion: null,
        suggestionGeneratedAt: null,
        raw: {},
      });

      return NextResponse.json({ ok: true, body: suggestion.trim() });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/send' });
    }
  },
);
