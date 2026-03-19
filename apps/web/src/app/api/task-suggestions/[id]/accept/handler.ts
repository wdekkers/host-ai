import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { taskSuggestions, taskReminders } from '@walt/db';
import { acceptSuggestionInputSchema } from '@walt/contracts';
import type { AcceptSuggestionInput, AuthContext } from '@walt/contracts';

type Deps = {
  getSuggestion?: (id: string, orgId: string) => Promise<Record<string, unknown> | null>;
  createTask?: (args: Record<string, unknown>) => Promise<{ id: string }>;
  markAccepted?: (id: string) => Promise<void>;
  createReminder?: (args: Record<string, unknown>) => Promise<{ id: string }>;
};

async function defaultGetSuggestion(id: string, orgId: string) {
  const { db } = await import('@/lib/db');
  const [row] = await db
    .select()
    .from(taskSuggestions)
    .where(eq(taskSuggestions.id, id))
    .limit(1);
  if (!row || row.organizationId !== orgId) return null;
  return row as Record<string, unknown>;
}

async function defaultCreateTask(args: Record<string, unknown>) {
  const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';
  const res = await fetch(`${gatewayBaseUrl}/tasks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: (args.authorization as string) ?? '',
    },
    body: JSON.stringify(args.body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Gateway error ${res.status}`);
  return res.json() as Promise<{ id: string }>;
}

async function defaultMarkAccepted(id: string) {
  const { db } = await import('@/lib/db');
  await db
    .update(taskSuggestions)
    .set({ status: 'accepted' })
    .where(eq(taskSuggestions.id, id));
}

async function defaultCreateReminder(args: Record<string, unknown>) {
  const { db } = await import('@/lib/db');
  const [row] = await db
    .insert(taskReminders)
    .values({
      taskId: args.taskId as string,
      organizationId: args.organizationId as string,
      taskTitle: args.taskTitle as string,
      propertyName: args.propertyName as string,
      channels: args.channels as string[],
      scheduledFor: new Date(args.scheduledFor as string),
    })
    .returning();
  return row as { id: string };
}

export async function handleAcceptSuggestion(
  request: Request,
  context: { params: Promise<{ id: string }> },
  auth: AuthContext,
  deps: Deps = {},
) {
  const { id } = await context.params;
  const getSuggestion = deps.getSuggestion ?? defaultGetSuggestion;
  const createTask = deps.createTask ?? defaultCreateTask;
  const markAccepted = deps.markAccepted ?? defaultMarkAccepted;
  const createReminder = deps.createReminder ?? defaultCreateReminder;

  const suggestion = await getSuggestion(id, auth.orgId);
  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: AcceptSuggestionInput = {};
  try {
    body = acceptSuggestionInputSchema.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let task: { id: string };
  try {
    task = await createTask({
      authorization: request.headers.get('authorization'),
      body: {
        title: suggestion.title,
        description: suggestion.description,
        priority: 'medium',
        propertyIds: [suggestion.propertyId],
        dueDate: suggestion.suggestedDueDate ?? undefined,
        source: 'ai',
        sourceReservationId: suggestion.reservationId,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 502 });
  }

  await markAccepted(id);

  if (body.reminderChannels?.length && body.reminderTime) {
    try {
      const reminder = await createReminder({
        taskId: task.id,
        organizationId: auth.orgId,
        taskTitle: suggestion.title as string,
        propertyName: suggestion.propertyName as string,
        channels: body.reminderChannels,
        scheduledFor: body.reminderTime,
      });
      return NextResponse.json({ task, reminder });
    } catch {
      return NextResponse.json({
        task,
        reminder: null,
        reminderWarning: 'Reminder could not be saved',
      });
    }
  }

  return NextResponse.json({ task, reminder: null });
}
