import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { auditEvents, smsConsents, smsMessageLogs, vendors } from '@walt/db';

import {
  CONFIRMATION_SMS,
  CONSENT_TEXT_V1,
  CONSENT_TEXT_VERSION,
  OPT_OUT_SMS,
} from '../consent-text.js';
import { toE164 } from '../lib/phone.js';
import { sendSms } from '../twilio.js';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

const optInBodySchema = z.object({
  contactName: z.string().min(1),
  companyName: z.string().optional(),
  phone: z.string().min(1),
  checkboxChecked: z.boolean(),
  sourceUrl: z.string().url(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const optOutBodySchema = z.object({
  phone: z.string().min(1),
  sendConfirmation: z.boolean().optional().default(true),
});

export function registerConsentRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof getDb>,
  skipTwilio = false,
) {
  // POST /consent/opt-in
  app.post('/consent/opt-in', async (request, reply) => {
    const parsed = optInBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { contactName, companyName, phone, checkboxChecked, sourceUrl, ipAddress, userAgent } =
      parsed.data;

    if (!checkboxChecked) {
      return reply.status(400).send({ error: 'Consent checkbox must be checked' });
    }

    const phoneE164 = toE164(phone);
    if (!phoneE164) {
      return reply.status(400).send({ error: 'Invalid phone number — must be a valid US number' });
    }

    const now = new Date();
    const sourceDomain = new URL(sourceUrl).hostname;

    // Upsert vendor by phone number
    const vendorId = uuidv4();
    const [vendor] = await db
      .insert(vendors)
      .values({
        id: vendorId,
        contactName,
        companyName: companyName ?? '',
        phoneE164,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: vendors.phoneE164,
        set: {
          contactName,
          companyName: companyName ?? '',
          status: 'active',
          updatedAt: now,
        },
      })
      .returning({ id: vendors.id });

    const resolvedVendorId = vendor!.id;
    const consentId = uuidv4();

    await db.insert(smsConsents).values({
      id: consentId,
      vendorId: resolvedVendorId,
      consentStatus: 'opted_in',
      consentMethod: 'web_form',
      consentTextVersion: CONSENT_TEXT_VERSION,
      consentTextSnapshot: CONSENT_TEXT_V1,
      sourceUrl,
      sourceDomain,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      checkboxChecked: true,
      confirmedAt: now,
      revokedAt: null,
      createdAt: now,
    });

    await db.insert(auditEvents).values({
      id: uuidv4(),
      vendorId: resolvedVendorId,
      actorType: 'vendor',
      actorId: phoneE164,
      eventType: 'vendor.opted_in',
      metadata: { consentId, consentMethod: 'web_form', sourceUrl },
      createdAt: now,
    });

    if (!skipTwilio) {
      try {
        const sid = await sendSms({ to: phoneE164, body: CONFIRMATION_SMS });
        if (sid) {
          await db.insert(smsMessageLogs).values({
            id: uuidv4(),
            vendorId: resolvedVendorId,
            direction: 'outbound',
            twilioMessageSid: sid,
            fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
            toNumber: phoneE164,
            body: CONFIRMATION_SMS,
            messageType: 'consent_confirmation',
            deliveryStatus: null,
            createdAt: now,
          });
        }
      } catch (err) {
        // Consent is already recorded — log but don't fail the response
        app.log.error({ err }, 'Failed to send opt-in confirmation SMS');
      }
    }

    return reply.send({ vendorId: resolvedVendorId, phoneE164 });
  });

  // POST /consent/opt-out
  app.post('/consent/opt-out', async (request, reply) => {
    const parsed = optOutBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { phone, sendConfirmation } = parsed.data;
    const phoneE164 = toE164(phone);
    if (!phoneE164) {
      return reply.status(400).send({ error: 'Invalid phone number' });
    }

    const [vendor] = await db
      .select({ id: vendors.id, status: vendors.status })
      .from(vendors)
      .where(eq(vendors.phoneE164, phoneE164))
      .limit(1);

    if (!vendor) {
      return reply.status(404).send({ error: 'No vendor found with that phone number' });
    }

    const now = new Date();

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
      actorId: phoneE164,
      eventType: 'vendor.opted_out',
      metadata: { method: 'web_form' },
      createdAt: now,
    });

    if (sendConfirmation && !skipTwilio) {
      try {
        const sid = await sendSms({ to: phoneE164, body: OPT_OUT_SMS });
        if (sid) {
          await db.insert(smsMessageLogs).values({
            id: uuidv4(),
            vendorId: vendor.id,
            direction: 'outbound',
            twilioMessageSid: sid,
            fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
            toNumber: phoneE164,
            body: OPT_OUT_SMS,
            messageType: 'stop_confirmation',
            deliveryStatus: null,
            createdAt: now,
          });
        }
      } catch (err) {
        app.log.error({ err }, 'Failed to send opt-out confirmation SMS');
      }
    }

    return reply.send({ success: true, phoneE164 });
  });
}
