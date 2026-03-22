import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { scoreGuest } from '@/lib/guest-scoring';
import { reservations } from '@walt/db';

export async function handleScoreGuest(reservationId: string) {
  const [reservation] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!reservation) {
    return { error: 'Reservation not found', status: 404 } as const;
  }

  const result = await scoreGuest(reservationId);
  if (!result) {
    return { error: 'Scoring failed', status: 503 } as const;
  }

  await db
    .update(reservations)
    .set({
      guestScore: result.score,
      guestScoreSummary: result.summary,
      guestScoredAt: new Date(),
    })
    .where(eq(reservations.id, reservationId));

  return {
    score: result.score,
    summary: result.summary,
    scoredAt: new Date().toISOString(),
  };
}
