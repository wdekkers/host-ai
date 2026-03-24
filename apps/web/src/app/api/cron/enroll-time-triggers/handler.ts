import { NextResponse } from 'next/server';
import { and, eq, inArray, lte, gte, sql } from 'drizzle-orm';
import { journeys, reservations } from '@walt/db';
import { journeyStepSchema } from '@walt/contracts';
import type { JourneyStep } from '@walt/contracts';
import {
  enrollReservation,
  createEnrollmentDeps,
  type EnrollmentDbDeps,
} from '@/lib/journeys/enrollment';

// Trigger types handled by this cron
const TIME_TRIGGER_TYPES = [
  'check_in_approaching',
  'check_out_approaching',
  'check_in',
  'check_out',
] as const;

type TimeTriggerType = (typeof TIME_TRIGGER_TYPES)[number];

type Deps = {
  cronSecret?: string;
  enrollmentDeps?: EnrollmentDbDeps;
};

export async function handleEnrollTimeTriggers(
  request: Request,
  deps: Deps = {},
): Promise<Response> {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
  const enrollDeps = deps.enrollmentDeps ?? createEnrollmentDeps(db);
  const now = new Date();

  type JourneyRow = {
    id: string;
    organizationId: string;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    steps: unknown;
    version: number;
    propertyIds: string[];
  };

  // Query all active journeys with a time-based trigger type
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
    .where(
      and(
        eq(journeys.status, 'active'),
        inArray(journeys.triggerType, TIME_TRIGGER_TYPES as unknown as string[]),
      ),
    );

  const activeJourneys: JourneyRow[] = rawJourneys.map((j) => ({
    ...j,
    triggerConfig:
      j.triggerConfig !== null && typeof j.triggerConfig === 'object'
        ? (j.triggerConfig as Record<string, unknown>)
        : {},
  }));

  let enrolled = 0;

  for (const journey of activeJourneys) {
    const triggerType = journey.triggerType as TimeTriggerType;

    // Parse offsetHours from triggerConfig
    const rawOffset = journey.triggerConfig?.offsetHours;
    const offsetHours = typeof rawOffset === 'number' ? rawOffset : 0;

    // Parse steps
    const rawSteps = Array.isArray(journey.steps) ? journey.steps : [];
    const steps: JourneyStep[] = rawSteps
      .map((s: unknown) => journeyStepSchema.safeParse(s))
      .filter(
        (r): r is { success: true; data: JourneyStep } => r.success,
      )
      .map((r) => r.data);

    if (steps.length === 0) continue;

    // Determine which reservations match the trigger condition
    const matchingReservations = await queryReservationsForTrigger(
      db,
      triggerType,
      offsetHours,
      journey.propertyIds,
      now,
    );

    for (const reservation of matchingReservations) {
      if (!reservation.propertyId) continue;

      const result = await enrollReservation(
        journey.id,
        reservation.id,
        journey.organizationId,
        steps,
        journey.version,
        enrollDeps,
      );

      if (result !== null) {
        enrolled++;
      }
    }
  }

  return NextResponse.json({ ok: true, enrolled });
}

// ── helpers ──

type ReservationCandidate = {
  id: string;
  propertyId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  arrivalDate: Date | null;
  departureDate: Date | null;
};

async function queryReservationsForTrigger(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  triggerType: TimeTriggerType,
  offsetHours: number,
  propertyIds: string[],
  now: Date,
): Promise<ReservationCandidate[]> {
  const baseSelect = {
    id: reservations.id,
    propertyId: reservations.propertyId,
    checkIn: reservations.checkIn,
    checkOut: reservations.checkOut,
    arrivalDate: reservations.arrivalDate,
    departureDate: reservations.departureDate,
  };

  const propertyFilter =
    propertyIds.length > 0
      ? inArray(reservations.propertyId, propertyIds)
      : undefined;

  if (triggerType === 'check_in_approaching') {
    // checkIn - offsetHours <= now  =>  checkIn <= now + offsetHours
    const upperBound = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
    const condition = and(
      lte(reservations.checkIn, upperBound),
      gte(reservations.checkIn, now),
      ...(propertyFilter ? [propertyFilter] : []),
    );
    return db.select(baseSelect).from(reservations).where(condition);
  }

  if (triggerType === 'check_out_approaching') {
    const upperBound = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
    const condition = and(
      lte(reservations.checkOut, upperBound),
      gte(reservations.checkOut, now),
      ...(propertyFilter ? [propertyFilter] : []),
    );
    return db.select(baseSelect).from(reservations).where(condition);
  }

  if (triggerType === 'check_in') {
    // checkIn is today
    const todayStr = now.toISOString().slice(0, 10);
    const condition = and(
      sql`${reservations.checkIn}::date = ${todayStr}::date`,
      ...(propertyFilter ? [propertyFilter] : []),
    );
    return db.select(baseSelect).from(reservations).where(condition);
  }

  if (triggerType === 'check_out') {
    // checkOut is today
    const todayStr = now.toISOString().slice(0, 10);
    const condition = and(
      sql`${reservations.checkOut}::date = ${todayStr}::date`,
      ...(propertyFilter ? [propertyFilter] : []),
    );
    return db.select(baseSelect).from(reservations).where(condition);
  }

  return [];
}
