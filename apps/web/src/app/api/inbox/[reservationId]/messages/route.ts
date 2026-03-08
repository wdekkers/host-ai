import { and, desc, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { messages } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const GET = withPermission('dashboard.read', async (request: Request, { params }: Params) => {
  try {
    const { reservationId } = await params;
    const url = new URL(request.url);
    const before = url.searchParams.get('before');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

    const conditions = [eq(messages.reservationId, reservationId)];
    if (before) {
      conditions.push(lt(messages.createdAt, new Date(before)));
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).reverse();

    return NextResponse.json({ messages: items, hasMore });
  } catch (error) {
    return handleApiError({ error, route: '/api/inbox/[reservationId]/messages' });
  }
});
