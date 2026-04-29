import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { reservations } from '@walt/db';
import {
  assessGuest,
  type Assessment,
  type AssessmentTrigger,
} from '@/lib/guest-assessment';
import { handleApiError } from '@/lib/secure-logger';

const bodySchema = z.object({
  trigger: z.enum(['manual_rescore', 'feedback']).optional(),
});

type Deps = {
  findReservation?: (id: string) => Promise<{ id: string } | null>;
  assess?: (
    id: string,
    opts: { organizationId: string; trigger: AssessmentTrigger; userId?: string },
  ) => Promise<Assessment | null>;
};

async function defaultFind(id: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(eq(reservations.id, id))
    .limit(1);
  return row ?? null;
}

export async function handleAssess(
  request: Request,
  reservationId: string,
  auth: { orgId: string; userId: string },
  deps: Deps = {},
): Promise<Response> {
  try {
    const findReservation = deps.findReservation ?? defaultFind;
    const reservation = await findReservation(reservationId);
    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    const trigger: AssessmentTrigger =
      parsed.success && parsed.data.trigger ? parsed.data.trigger : 'manual_rescore';

    const assess = deps.assess ?? assessGuest;
    const result = await assess(reservationId, {
      organizationId: auth.orgId,
      trigger,
      userId: auth.userId,
    });
    if (!result) {
      return NextResponse.json({ error: 'Assessment failed' }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError({ error, route: '/api/inbox/[reservationId]/assess' });
  }
}
