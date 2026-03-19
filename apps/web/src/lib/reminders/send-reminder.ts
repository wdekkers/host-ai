import type { OwnerContact } from './resolve-owner-contact';

type ReminderPayload = {
  id: string;
  taskId: string;
  organizationId: string;
  channels: ('sms' | 'email')[];
  scheduledFor: Date;
  taskTitle: string;
  propertyName: string;
};

type SendReminderDeps = {
  resolveContact?: (orgId: string) => Promise<OwnerContact>;
  sendSms?: (to: string, body: string) => Promise<void>;
  sendEmail?: (to: string, subject: string, text: string) => Promise<void>;
};

async function defaultSendSms(to: string, body: string) {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({ from: process.env.TWILIO_FROM_NUMBER ?? '', to, body });
}

async function defaultSendEmail(to: string, subject: string, text: string) {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: 'walt@notifications.walt.ai', to, subject, text });
}

export async function sendReminder(payload: ReminderPayload, deps: SendReminderDeps = {}) {
  const { resolveOwnerContact } = await import('./resolve-owner-contact');
  const resolveContact = deps.resolveContact ?? resolveOwnerContact;
  const sendSms = deps.sendSms ?? defaultSendSms;
  const sendEmail = deps.sendEmail ?? defaultSendEmail;

  const contact = await resolveContact(payload.organizationId);

  const emailText = [
    `Hi, this is a reminder for your task at ${payload.propertyName}.`,
    '',
    `Task: ${payload.taskTitle}`,
    `Due: ${payload.scheduledFor.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
    '',
    'View your dashboard: https://app.walt.ai/today',
  ].join('\n');

  const sends: Promise<void>[] = [];

  if (payload.channels.includes('sms')) {
    if (contact.phone) {
      sends.push(sendSms(contact.phone, `[Walt] Reminder: ${payload.taskTitle} — ${payload.propertyName}`));
    } else {
      console.warn(`[reminders] No phone for org ${payload.organizationId}, skipping SMS`);
    }
  }

  if (payload.channels.includes('email') && contact.email) {
    sends.push(sendEmail(contact.email, `Reminder: ${payload.taskTitle}`, emailText));
  }

  await Promise.all(sends);
}
