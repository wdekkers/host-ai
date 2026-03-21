import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { guests } from '@walt/db';

export const GET = withPermission('guests.read', async (_request, _context, auth) => {
  const rows = await db
    .select()
    .from(guests)
    .where(eq(guests.organizationId, auth.orgId))
    .orderBy(guests.lastName, guests.firstName);

  return NextResponse.json({ guests: rows });
});
