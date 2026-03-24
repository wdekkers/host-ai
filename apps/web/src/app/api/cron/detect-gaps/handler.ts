import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { journeys, propertyAccess, reservations } from '@walt/db';
import { journeyStepSchema } from '@walt/contracts';
import type { JourneyStep } from '@walt/contracts';
import {
  enrollReservation,
  createEnrollmentDeps,
  type EnrollmentDbDeps,
} from '@/lib/journeys/enrollment';

type Deps = {
  cronSecret?: string;
  enrollmentDeps?: EnrollmentDbDeps;
};

type ReservationWindow = {
  id: string;
  propertyId: string | null;
  arrivalDate: Date | null;
  departureDate: Date | null;
};

type JourneyRow = {
  id: string;
  organizationId: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: unknown;
  version: number;
  propertyIds: string[];
};

export async function handleDetectGaps(
  request: Request,
  deps: Deps = {},
): Promise<Response> {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const enrollDeps = deps.enrollmentDeps ?? createEnrollmentDeps(db);

  // Query active journeys with gap_detected trigger
  const rawJourneys: Array<{
    id: string;
    organizationId: string;
    triggerType: string;
    triggerConfig: unknown;
    steps: unknown;
    version: number;
    propertyIds: string[];
  }> = await db
    .select({
      id: journeys.id,
      organizationId: journeys.organizationId,
      triggerType: journeys.triggerType,
      triggerConfig: journeys.triggerConfig,
      steps: journeys.steps,
      version: journeys.version,
      propertyIds: journeys.propertyIds,
    })
    .from(journeys)
    .where(and(eq(journeys.status, 'active'), eq(journeys.triggerType, 'gap_detected')));

  const activeJourneys: JourneyRow[] = rawJourneys.map((j) => ({
    ...j,
    triggerConfig:
      j.triggerConfig !== null && typeof j.triggerConfig === 'object'
        ? (j.triggerConfig as Record<string, unknown>)
        : {},
  }));

  let enrolled = 0;

  for (const journey of activeJourneys) {
    // Parse maxGapNights from triggerConfig
    const rawMax = journey.triggerConfig.maxGapNights;
    const maxGapNights = typeof rawMax === 'number' ? rawMax : 2;

    // Parse steps
    const rawSteps = Array.isArray(journey.steps) ? journey.steps : [];
    const steps: JourneyStep[] = rawSteps
      .map((s: unknown) => journeyStepSchema.safeParse(s))
      .filter((r): r is { success: true; data: JourneyStep } => r.success)
      .map((r) => r.data);

    if (steps.length === 0) continue;

    // Determine which properties to scan
    const propertyIds: string[] =
      journey.propertyIds.length > 0
        ? journey.propertyIds
        : await fetchPropertyIdsForOrg(db, journey.organizationId);

    for (const propertyId of propertyIds) {
      // Fetch reservations for this property ordered by arrivalDate
      const propertyReservations: ReservationWindow[] = await db
        .select({
          id: reservations.id,
          propertyId: reservations.propertyId,
          arrivalDate: reservations.arrivalDate,
          departureDate: reservations.departureDate,
        })
        .from(reservations)
        .where(
          and(
            eq(reservations.propertyId, propertyId),
            inArray(reservations.status, ['confirmed', 'accepted']),
          ),
        )
        .orderBy(asc(reservations.arrivalDate));

      // Find gaps between consecutive reservations
      for (let i = 0; i < propertyReservations.length - 1; i++) {
        const current = propertyReservations[i];
        const next = propertyReservations[i + 1];

        if (!current || !next) continue;
        if (!current.departureDate || !next.arrivalDate) continue;

        const gapMs = next.arrivalDate.getTime() - current.departureDate.getTime();
        const gapNights = gapMs / (1000 * 60 * 60 * 24);

        // Gap must be > 0 and <= maxGapNights
        if (gapNights <= 0 || gapNights > maxGapNights) continue;

        // Enroll both adjacent reservations
        const enrollCurrent = await enrollReservation(
          journey.id,
          current.id,
          journey.organizationId,
          steps,
          journey.version,
          enrollDeps,
        );
        if (enrollCurrent !== null) enrolled++;

        const enrollNext = await enrollReservation(
          journey.id,
          next.id,
          journey.organizationId,
          steps,
          journey.version,
          enrollDeps,
        );
        if (enrollNext !== null) enrolled++;
      }
    }
  }

  return NextResponse.json({ ok: true, enrolled });
}

// ── helpers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPropertyIdsForOrg(db: any, orgId: string): Promise<string[]> {
  const rows: Array<{ propertyId: string }> = await db
    .selectDistinct({ propertyId: propertyAccess.propertyId })
    .from(propertyAccess)
    .where(eq(propertyAccess.organizationId, orgId));
  return rows.map((r) => r.propertyId);
}
