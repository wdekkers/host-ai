import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { guests, reservations, scoringRules } from '@walt/db';

import { db } from '@/lib/db';
import { scoreGuest } from '@/lib/guest-scoring';
import { handleApiError } from '@/lib/secure-logger';

const bodySchema = z.object({
  text: z.string().trim().min(1).max(1000),
  target: z.enum(['rule', 'guest']),
});

type Deps = {
  createRule?: (args: {
    orgId: string;
    userId: string;
    ruleText: string;
  }) => Promise<{ id: string }>;
  appendGuestNote?: (args: {
    orgId: string;
    reservationId: string;
    note: string;
  }) => Promise<{ ok: true }>;
  rescore?: (
    reservationId: string,
  ) => Promise<{ score: number; summary: string } | null>;
};

async function defaultCreateRule(args: {
  orgId: string;
  userId: string;
  ruleText: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(scoringRules)
    .values({
      id: uuidv4(),
      organizationId: args.orgId,
      ruleText: args.ruleText,
      active: true,
      createdBy: args.userId,
    })
    .returning({ id: scoringRules.id });
  if (!row) throw new Error('Failed to create scoring rule');
  return row;
}

async function defaultAppendGuestNote(args: {
  orgId: string;
  reservationId: string;
  note: string;
}): Promise<{ ok: true }> {
  const [reservation] = await db
    .select({
      firstName: reservations.guestFirstName,
      lastName: reservations.guestLastName,
    })
    .from(reservations)
    .where(eq(reservations.id, args.reservationId))
    .limit(1);
  if (!reservation || !reservation.firstName || !reservation.lastName) {
    throw new Error('Reservation or guest name not found');
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const line = `[${timestamp}] ${args.note}`;

  const [existing] = await db
    .select({ id: guests.id, notes: guests.notes })
    .from(guests)
    .where(
      and(
        eq(guests.organizationId, args.orgId),
        eq(guests.firstName, reservation.firstName),
        eq(guests.lastName, reservation.lastName),
      ),
    )
    .limit(1);

  if (existing) {
    const combined = existing.notes ? `${existing.notes}\n${line}` : line;
    await db
      .update(guests)
      .set({ notes: combined, updatedAt: new Date() })
      .where(eq(guests.id, existing.id));
  } else {
    await db.insert(guests).values({
      id: uuidv4(),
      organizationId: args.orgId,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      notes: line,
    });
  }

  return { ok: true as const };
}

async function persistRescore(
  reservationId: string,
): Promise<{ score: number; summary: string } | null> {
  const result = await scoreGuest(reservationId);
  if (!result) return null;
  await db
    .update(reservations)
    .set({
      guestScore: result.score,
      guestScoreSummary: result.summary,
      guestScoredAt: new Date(),
    })
    .where(eq(reservations.id, reservationId));
  return result;
}

export async function handleFeedback(
  request: Request,
  reservationId: string,
  auth: { orgId: string; userId: string },
  deps: Deps = {},
): Promise<Response> {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { text, target } = parsed.data;

    const createRule = deps.createRule ?? defaultCreateRule;
    const appendGuestNote = deps.appendGuestNote ?? defaultAppendGuestNote;
    const rescore = deps.rescore ?? persistRescore;

    if (target === 'rule') {
      await createRule({ orgId: auth.orgId, userId: auth.userId, ruleText: text });
    } else {
      await appendGuestNote({ orgId: auth.orgId, reservationId, note: text });
    }

    // Rescore is best-effort. If it fails, the save still succeeded — surface that
    // clearly to the client instead of masking it as a generic 400.
    let result: { score: number; summary: string } | null = null;
    let rescoreError: string | null = null;
    try {
      result = await rescore(reservationId);
    } catch (err) {
      rescoreError = err instanceof Error ? err.message : String(err);
      console.error(
        `[feedback] rescore threw for reservation ${reservationId}:`,
        err,
      );
    }

    return NextResponse.json({
      saved: true,
      score: result?.score ?? null,
      summary: result?.summary ?? null,
      rescoreError: rescoreError ?? (result ? null : 'Rescore returned no result.'),
    });
  } catch (error) {
    console.error('[feedback] handler threw:', error);
    return handleApiError({ error, route: '/api/inbox/[id]/feedback' });
  }
}
