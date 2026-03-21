import { asc, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { opsThreads, opsThreadParticipants, opsMessages } from '@walt/db';

export const GET = withPermission('contacts.read', async (_request, _context, auth) => {
  const threads = await db
    .select({
      id: opsThreads.id,
      name: opsThreads.name,
      type: opsThreads.type,
      createdAt: opsThreads.createdAt,
      updatedAt: opsThreads.updatedAt,
      lastMessageBody: sql<string | null>`(
        SELECT ${opsMessages.body}
        FROM ${opsMessages}
        WHERE ${opsMessages.threadId} = ${opsThreads.id}
        ORDER BY ${opsMessages.createdAt} DESC
        LIMIT 1
      )`.as('last_message_body'),
      lastMessageAt: sql<string | null>`(
        SELECT ${opsMessages.createdAt}::text
        FROM ${opsMessages}
        WHERE ${opsMessages.threadId} = ${opsThreads.id}
        ORDER BY ${opsMessages.createdAt} DESC
        LIMIT 1
      )`.as('last_message_at'),
      participantCount: sql<number>`(
        SELECT count(*)::int
        FROM ${opsThreadParticipants}
        WHERE ${opsThreadParticipants.threadId} = ${opsThreads.id}
      )`.as('participant_count'),
    })
    .from(opsThreads)
    .where(eq(opsThreads.organizationId, auth.orgId))
    .orderBy(desc(opsThreads.updatedAt));

  // Load participants per thread
  const threadIds = threads.map((t) => t.id);
  const participants = threadIds.length > 0
    ? await db.select().from(opsThreadParticipants).orderBy(asc(opsThreadParticipants.displayName))
    : [];

  const participantsByThread = new Map<string, typeof participants>();
  for (const p of participants) {
    const list = participantsByThread.get(p.threadId) ?? [];
    list.push(p);
    participantsByThread.set(p.threadId, list);
  }

  const result = threads.map((t) => ({
    ...t,
    participants: participantsByThread.get(t.id) ?? [],
  }));

  return NextResponse.json({ threads: result });
});

const createThreadSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['direct', 'group']),
  participants: z.array(z.object({
    displayName: z.string().min(1),
    phoneE164: z.string().min(5),
  })).min(1),
});

export const POST = withPermission('contacts.create', async (request, _context, auth) => {
  const parsed = createThreadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const threadId = randomUUID();
  const threadName = parsed.data.type === 'group'
    ? (parsed.data.name ?? parsed.data.participants.map((p) => p.displayName).join(', '))
    : parsed.data.participants[0]?.displayName ?? 'Thread';

  await db.insert(opsThreads).values({
    id: threadId,
    organizationId: auth.orgId,
    name: threadName,
    type: parsed.data.type,
  });

  await db.insert(opsThreadParticipants).values(
    parsed.data.participants.map((p) => ({
      id: randomUUID(),
      threadId,
      displayName: p.displayName,
      phoneE164: p.phoneE164,
    })),
  );

  return NextResponse.json({ threadId }, { status: 201 });
});
