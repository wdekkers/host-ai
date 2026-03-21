import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { guests, reservations } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

const updateGuestSchema = z.object({
  hostAgain: z.enum(['yes', 'no', 'undecided']).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const GET = withPermission('guests.read', async (_request, context: Params, auth) => {
  const { id } = await context.params;

  const [guest] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, id), eq(guests.organizationId, auth.orgId)));

  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  const stays = await db
    .select({
      id: reservations.id,
      propertyName: reservations.propertyName,
      arrivalDate: reservations.arrivalDate,
      departureDate: reservations.departureDate,
      status: reservations.status,
      platform: reservations.platform,
    })
    .from(reservations)
    .where(eq(reservations.guestId, guest.platformGuestId ?? ''))
    .orderBy(reservations.arrivalDate);

  return NextResponse.json({ guest, stays });
});

export const PATCH = withPermission('guests.update', async (request, context: Params, auth) => {
  const { id } = await context.params;
  const parsed = updateGuestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.hostAgain !== undefined) updates.hostAgain = parsed.data.hostAgain;
  if (parsed.data.rating !== undefined) updates.rating = parsed.data.rating;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  const [updated] = await db
    .update(guests)
    .set(updates)
    .where(and(eq(guests.id, id), eq(guests.organizationId, auth.orgId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  return NextResponse.json({ guest: updated });
});
