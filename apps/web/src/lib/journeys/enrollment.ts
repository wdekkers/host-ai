import { and, eq, inArray } from 'drizzle-orm';
import { journeyEnrollments, journeyExclusions, journeys, reservations } from '@walt/db';
import type { JourneyStep } from '@walt/contracts';

// ── Shared result types ──

export type EnrollmentResult = {
  id: string;
  journeyId: string;
  reservationId: string;
  organizationId: string;
} | null;

export type ActiveJourney = {
  id: string;
  organizationId: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: unknown;
  version: number;
  propertyIds: string[];
};

export type ReservationRow = {
  id: string;
  propertyId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  arrivalDate: Date | null;
  departureDate: Date | null;
  status: string | null;
};

// ── Dependency injection interface ──

export type EnrollmentDbDeps = {
  findEnrollment: (journeyId: string, reservationId: string) => Promise<{ id: string } | null>;
  findExclusion: (journeyId: string, reservationId: string) => Promise<{ id: string } | null>;
  insertEnrollment: (row: {
    journeyId: string;
    reservationId: string;
    organizationId: string;
    journeyVersion: number;
    context: Record<string, unknown>;
    nextExecutionAt: Date;
    status: string;
  }) => Promise<{ id: string; journeyId: string; reservationId: string; organizationId: string }>;
  findActiveJourneys: (triggerType: string, orgId: string) => Promise<ActiveJourney[]>;
  findReservationsByPropertyIds: (
    propertyIds: string[],
    filterFn?: (r: ReservationRow) => boolean,
  ) => Promise<ReservationRow[]>;
};

// ── enrollReservation ──

/**
 * Enroll a reservation into a journey.
 * Returns null if an enrollment already exists or the reservation is excluded.
 */
export async function enrollReservation(
  journeyId: string,
  reservationId: string,
  orgId: string,
  steps: JourneyStep[],
  version: number,
  deps: EnrollmentDbDeps,
): Promise<EnrollmentResult> {
  const existing = await deps.findEnrollment(journeyId, reservationId);
  if (existing) return null;

  const exclusion = await deps.findExclusion(journeyId, reservationId);
  if (exclusion) return null;

  return deps.insertEnrollment({
    journeyId,
    reservationId,
    organizationId: orgId,
    journeyVersion: version,
    context: { stepsSnapshot: steps },
    nextExecutionAt: new Date(),
    status: 'active',
  });
}

// ── findMatchingJourneys ──

/**
 * Find active journeys for the given trigger type that apply to a property.
 * Journeys with empty propertyIds match all properties.
 */
export async function findMatchingJourneys(
  triggerType: string,
  propertyId: string,
  orgId: string,
  deps: EnrollmentDbDeps,
): Promise<ActiveJourney[]> {
  const allJourneys = await deps.findActiveJourneys(triggerType, orgId);
  return allJourneys.filter(
    (j) => j.propertyIds.length === 0 || j.propertyIds.includes(propertyId),
  );
}

// ── createEnrollmentDeps ──

/**
 * Build EnrollmentDbDeps backed by a live Drizzle db client.
 * Pass `db` from `await import('@/lib/db')`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEnrollmentDeps(db: any): EnrollmentDbDeps {
  return {
    async findEnrollment(journeyId, reservationId) {
      const rows: Array<{ id: string }> = await db
        .select({ id: journeyEnrollments.id })
        .from(journeyEnrollments)
        .where(
          and(
            eq(journeyEnrollments.journeyId, journeyId),
            eq(journeyEnrollments.reservationId, reservationId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async findExclusion(journeyId, reservationId) {
      const rows: Array<{ id: string }> = await db
        .select({ id: journeyExclusions.id })
        .from(journeyExclusions)
        .where(
          and(
            eq(journeyExclusions.journeyId, journeyId),
            eq(journeyExclusions.reservationId, reservationId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async insertEnrollment(row) {
      const id = crypto.randomUUID();
      await db.insert(journeyEnrollments).values({
        id,
        journeyId: row.journeyId,
        reservationId: row.reservationId,
        organizationId: row.organizationId,
        journeyVersion: row.journeyVersion,
        context: row.context,
        nextExecutionAt: row.nextExecutionAt,
        status: row.status,
      });
      return {
        id,
        journeyId: row.journeyId,
        reservationId: row.reservationId,
        organizationId: row.organizationId,
      };
    },

    async findActiveJourneys(triggerType, orgId) {
      const rows: ActiveJourney[] = await db
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
            eq(journeys.triggerType, triggerType),
            eq(journeys.status, 'active'),
            eq(journeys.organizationId, orgId),
          ),
        );
      return rows;
    },

    async findReservationsByPropertyIds(propertyIds, filterFn) {
      if (propertyIds.length === 0) return [];
      const rows: ReservationRow[] = await db
        .select({
          id: reservations.id,
          propertyId: reservations.propertyId,
          checkIn: reservations.checkIn,
          checkOut: reservations.checkOut,
          arrivalDate: reservations.arrivalDate,
          departureDate: reservations.departureDate,
          status: reservations.status,
        })
        .from(reservations)
        .where(inArray(reservations.propertyId, propertyIds));
      return filterFn ? rows.filter(filterFn) : rows;
    },
  };
}
