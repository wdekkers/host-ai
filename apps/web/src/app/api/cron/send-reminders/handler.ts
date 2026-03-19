import { NextResponse } from 'next/server';
import { and, isNull, lte, eq } from 'drizzle-orm';
import { taskReminders } from '@walt/db';

type DueReminder = {
  id: string;
  taskId: string;
  organizationId: string;
  taskTitle: string;
  propertyName: string;
  channels: string[];
  scheduledFor: Date;
};

type Deps = {
  cronSecret?: string;
  getDueReminders?: () => Promise<DueReminder[]>;
  deliver?: (reminder: DueReminder) => Promise<void>;
  markSent?: (id: string) => Promise<void>;
};

export async function handleSendReminders(request: Request, deps: Deps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');

  const getDueReminders = deps.getDueReminders ?? (async () =>
    db.select().from(taskReminders).where(
      and(lte(taskReminders.scheduledFor, new Date()), isNull(taskReminders.sentAt)),
    ) as Promise<DueReminder[]>
  );

  const deliver = deps.deliver ?? (async (reminder: DueReminder) => {
    const { sendReminder } = await import('@/lib/reminders/send-reminder');
    await sendReminder({
      id: reminder.id,
      taskId: reminder.taskId,
      organizationId: reminder.organizationId,
      channels: reminder.channels as ('sms' | 'email')[],
      scheduledFor: reminder.scheduledFor,
      taskTitle: reminder.taskTitle,
      propertyName: reminder.propertyName,
    });
  });

  const markSent = deps.markSent ?? (async (id: string) => {
    await db.update(taskReminders).set({ sentAt: new Date() }).where(eq(taskReminders.id, id));
  });

  const due = await getDueReminders();
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    try {
      await deliver(reminder);
      await markSent(reminder.id);
      sent++;
    } catch (err) {
      console.error(`[reminders] Failed to deliver ${reminder.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
