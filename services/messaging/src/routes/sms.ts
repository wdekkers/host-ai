import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { auditEvents, smsMessageLogs } from '@walt/db';

import { canSendToVendor } from '../lib/sms-guard.js';
import { sendSms } from '../twilio.js';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

const sendBodySchema = z.object({
  vendorId: z.string().uuid(),
  toNumber: z.string().min(1),
  body: z.string().min(1).max(1600),
  messageType: z
    .enum(['operational', 'consent_confirmation', 'help', 'stop_confirmation'])
    .default('operational'),
});

export function registerSmsRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
  skipTwilio = false,
) {
  // POST /sms/send — guarded outbound SMS
  app.post('/sms/send', async (request, reply) => {
    const parsed = sendBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { vendorId, toNumber, body, messageType } = parsed.data;
    const now = new Date();

    const guard = await canSendToVendor(db, vendorId);
    if (!guard.allowed) {
      // Log the blocked attempt for audit purposes
      await db.insert(auditEvents).values({
        id: uuidv4(),
        vendorId,
        actorType: 'system',
        actorId: null,
        eventType: 'sms.blocked',
        metadata: { reason: guard.reason, toNumber },
        createdAt: now,
      });

      return reply.status(403).send({ error: 'Send blocked', reason: guard.reason });
    }

    let twilioSid: string | null = null;
    if (!skipTwilio) {
      try {
        twilioSid = await sendSms({ to: toNumber, body });
      } catch (err) {
        app.log.error({ err }, 'Twilio send failed');
        return reply.status(502).send({ error: 'Failed to send SMS' });
      }
    }

    await db.insert(smsMessageLogs).values({
      id: uuidv4(),
      vendorId,
      direction: 'outbound',
      twilioMessageSid: twilioSid,
      fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
      toNumber,
      body,
      messageType,
      deliveryStatus: null,
      createdAt: now,
    });

    return reply.send({ success: true, twilioSid });
  });
}
