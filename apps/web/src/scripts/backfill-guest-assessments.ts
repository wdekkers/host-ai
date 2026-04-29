/**
 * One-shot backfill: for every reservation with guestScore set but no
 * guest_assessments row, insert a synthetic backfill row using the cached
 * score/summary so the audit table is non-empty on day one.
 *
 * Run: cd apps/web && pnpm exec tsx src/scripts/backfill-guest-assessments.ts
 */
import { eq, isNotNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/lib/db';
import { reservations, guestAssessments, organizations } from '@walt/db';

async function main(): Promise<void> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (!org) {
    console.log('No organizations found; nothing to backfill.');
    process.exit(0);
  }
  const orgId = org.id;

  const rows = await db
    .select({
      id: reservations.id,
      score: reservations.guestScore,
      summary: reservations.guestScoreSummary,
    })
    .from(reservations)
    .where(isNotNull(reservations.guestScore));

  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.score == null || !r.summary) {
      skipped += 1;
      continue;
    }
    const [existing] = await db
      .select({ id: guestAssessments.id })
      .from(guestAssessments)
      .where(eq(guestAssessments.reservationId, r.id))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    await db.insert(guestAssessments).values({
      id: uuidv4(),
      reservationId: r.id,
      organizationId: orgId,
      score: r.score,
      summary: r.summary,
      riskLevel: 'medium',
      trustLevel: 'medium',
      recommendation:
        'Backfilled from legacy 1-10 score; rescore for full risk/trust breakdown.',
      signals: [],
      rulesAcceptance: {
        requested: false,
        confirmed: false,
        confirmedAt: null,
        confirmationQuote: null,
      },
      trigger: 'backfill',
      model: 'backfill',
      promptVersion: 'backfill',
      inputsHash: 'backfill',
    });
    inserted += 1;
  }

  console.log(
    `Backfill complete. inserted=${inserted} skipped=${skipped} total=${rows.length}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
