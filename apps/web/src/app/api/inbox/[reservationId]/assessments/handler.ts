import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { guestAssessments } from '@walt/db';
import { handleApiError } from '@/lib/secure-logger';

export async function handleListAssessments(reservationId: string): Promise<Response> {
  try {
    const rows = await db
      .select()
      .from(guestAssessments)
      .where(eq(guestAssessments.reservationId, reservationId))
      .orderBy(desc(guestAssessments.createdAt));
    return NextResponse.json({ items: rows });
  } catch (error) {
    return handleApiError({ error, route: '/api/inbox/[reservationId]/assessments' });
  }
}
