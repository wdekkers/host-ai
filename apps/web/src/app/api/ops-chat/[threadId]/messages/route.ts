import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { opsMessages, opsThreads } from '@walt/db';

type Params = { params: Promise<{ threadId: string }> };

export const GET = withPermission('contacts.read', async (_request, context: Params) => {
  const { threadId } = await context.params;

  const messages = await db
    .select()
    .from(opsMessages)
    .where(eq(opsMessages.threadId, threadId))
    .orderBy(asc(opsMessages.createdAt));

  return NextResponse.json({ messages });
});

const sendMessageSchema = z.object({
  body: z.string().min(1),
});

export const POST = withPermission('contacts.create', async (request, context: Params) => {
  const { threadId } = await context.params;
  const parsed = sendMessageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const messageId = randomUUID();

  // Insert the outbound message
  await db.insert(opsMessages).values({
    id: messageId,
    threadId,
    senderName: null, // outbound from host
    senderPhone: null,
    direction: 'outbound',
    body: parsed.data.body,
  });

  // Update thread timestamp
  await db
    .update(opsThreads)
    .set({ updatedAt: new Date() })
    .where(eq(opsThreads.id, threadId));

  // TODO: fan-out SMS to all thread participants via Twilio

  return NextResponse.json({ messageId }, { status: 201 });
});
