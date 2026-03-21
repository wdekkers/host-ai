import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { smsMessageLogs } from '@walt/db';

type Params = { params: Promise<{ vendorId: string }> };

export const GET = withPermission('contacts.read', async (_request, context: Params) => {
  const { vendorId } = await context.params;

  const messages = await db
    .select({
      id: smsMessageLogs.id,
      direction: smsMessageLogs.direction,
      body: smsMessageLogs.body,
      createdAt: smsMessageLogs.createdAt,
      deliveryStatus: smsMessageLogs.deliveryStatus,
    })
    .from(smsMessageLogs)
    .where(eq(smsMessageLogs.vendorId, vendorId))
    .orderBy(asc(smsMessageLogs.createdAt));

  return NextResponse.json({ messages });
});
