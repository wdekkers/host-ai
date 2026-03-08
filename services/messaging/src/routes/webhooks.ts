import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { auditEvents, smsConsents, smsMessageLogs, vendors } from '@walt/db';

import {
  CONSENT_TEXT_V1,
  CONSENT_TEXT_VERSION,
  HELP_SMS,
  START_KEYWORDS,
  STOP_KEYWORDS,
} from '../consent-text.js';
import { validateTwilioSignature } from '../twilio.js';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function messageTag(text: string): string {
  return `<Message>${text}</Message>`;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
  skipSignatureValidation = false,
) {
  // Twilio sends form-encoded bodies
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      const parsed = Object.fromEntries(new URLSearchParams(body as string));
      done(null, parsed);
    },
  );

  // POST /webhooks/inbound — handle inbound SMS from Twilio
  app.post('/webhooks/inbound', async (request, reply) => {
    if (!skipSignatureValidation) {
      const signature = request.headers['x-twilio-signature'] as string | undefined;
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? '';
      const params = request.body as Record<string, string>;
      if (!signature || !validateTwilioSignature(signature, webhookUrl, params)) {
        return reply.status(403).send('Forbidden');
      }
    }

    const body = request.body as Record<string, string>;
    const fromNumber = body['From'] ?? '';
    const toNumber = body['To'] ?? '';
    const rawText = (body['Body'] ?? '').trim().toUpperCase();
    const now = new Date();

    reply.header('content-type', 'text/xml');

    const [vendor] = await db
      .select({ id: vendors.id, status: vendors.status })
      .from(vendors)
      .where(eq(vendors.phoneE164, fromNumber))
      .limit(1);

    if (STOP_KEYWORDS.has(rawText)) {
      if (vendor) {
        const [latestConsent] = await db
          .select({ id: smsConsents.id })
          .from(smsConsents)
          .where(eq(smsConsents.vendorId, vendor.id))
          .orderBy(desc(smsConsents.createdAt))
          .limit(1);

        if (latestConsent) {
          await db
            .update(smsConsents)
            .set({ consentStatus: 'opted_out', revokedAt: now })
            .where(eq(smsConsents.id, latestConsent.id));
        }

        await db
          .update(vendors)
          .set({ status: 'opted_out', updatedAt: now })
          .where(eq(vendors.id, vendor.id));

        await db.insert(auditEvents).values({
          id: uuidv4(),
          vendorId: vendor.id,
          actorType: 'vendor',
          actorId: fromNumber,
          eventType: 'vendor.opted_out',
          metadata: { method: 'inbound_sms', keyword: rawText },
          createdAt: now,
        });

        await db.insert(smsMessageLogs).values({
          id: uuidv4(),
          vendorId: vendor.id,
          direction: 'inbound',
          twilioMessageSid: body['MessageSid'] ?? null,
          fromNumber,
          toNumber,
          body: body['Body'] ?? '',
          messageType: 'stop_confirmation',
          deliveryStatus: null,
          createdAt: now,
        });
      }

      // Return empty TwiML — Twilio advanced opt-out handles the reply
      return reply.send(twiml(''));
    }

    if (START_KEYWORDS.has(rawText)) {
      if (vendor) {
        await db.insert(smsConsents).values({
          id: uuidv4(),
          vendorId: vendor.id,
          consentStatus: 'opted_in',
          consentMethod: 'inbound_sms',
          consentTextVersion: CONSENT_TEXT_VERSION,
          consentTextSnapshot: CONSENT_TEXT_V1,
          sourceUrl: 'sms://inbound',
          sourceDomain: 'sms',
          ipAddress: null,
          userAgent: null,
          checkboxChecked: false,
          confirmedAt: now,
          revokedAt: null,
          createdAt: now,
        });

        await db
          .update(vendors)
          .set({ status: 'active', updatedAt: now })
          .where(eq(vendors.id, vendor.id));

        await db.insert(auditEvents).values({
          id: uuidv4(),
          vendorId: vendor.id,
          actorType: 'vendor',
          actorId: fromNumber,
          eventType: 'vendor.opted_in',
          metadata: { method: 'inbound_sms', keyword: rawText },
          createdAt: now,
        });
      }

      return reply.send(twiml(''));
    }

    if (rawText === 'HELP') {
      return reply.send(twiml(messageTag(HELP_SMS)));
    }

    // General inbound message — store for shared inbox
    if (vendor) {
      await db.insert(smsMessageLogs).values({
        id: uuidv4(),
        vendorId: vendor.id,
        direction: 'inbound',
        twilioMessageSid: body['MessageSid'] ?? null,
        fromNumber,
        toNumber,
        body: body['Body'] ?? '',
        messageType: 'operational',
        deliveryStatus: null,
        createdAt: now,
      });
    }

    return reply.send(twiml(''));
  });

  // POST /webhooks/status — update delivery status by Twilio message SID
  app.post('/webhooks/status', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const sid = body['MessageSid'];
    const status = body['MessageStatus'];

    if (sid && status) {
      await db
        .update(smsMessageLogs)
        .set({ deliveryStatus: status })
        .where(eq(smsMessageLogs.twilioMessageSid, sid));
    }

    reply.header('content-type', 'text/xml');
    return reply.send(twiml(''));
  });
}
