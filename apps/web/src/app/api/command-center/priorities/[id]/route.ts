import { NextResponse } from 'next/server';

import { getPropertyStateInSingleton, listQueue } from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

const propertyIdFromReservation = (reservationId: string) => `property:${reservationId}`;

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const item = listQueue().find((entry) => entry.id === id);
  if (!item) {
    return NextResponse.json({ error: `Priority draft not found: ${id}` }, { status: 404 });
  }

  const propertyId = propertyIdFromReservation(item.reservationId);
  const propertyState = getPropertyStateInSingleton(propertyId);

  return NextResponse.json({
    detail: {
      draftId: item.id,
      reservationId: item.reservationId,
      propertyId,
      intent: item.intent,
      status: item.status,
      propertyState,
    },
  });
}
