import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { assessGuest } from '@/lib/guest-assessment';
import { reservations } from '@walt/db';

export async function handleScoreGuest(
  reservationId: string,
  auth: { orgId: string; userId?: string },
) {
  const [reservation] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!reservation) {
    return { error: 'Reservation not found', status: 404 } as const;
  }

  const result = await assessGuest(reservationId, {
    organizationId: auth.orgId,
    trigger: 'manual_rescore',
    userId: auth.userId,
  });
  if (!result) {
    return { error: 'Scoring failed', status: 503 } as const;
  }

  return {
    score: result.score,
    summary: result.summary,
    scoredAt: new Date().toISOString(),
  };
}
