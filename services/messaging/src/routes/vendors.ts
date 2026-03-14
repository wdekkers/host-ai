import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { auditEvents, smsConsents, smsMessageLogs, vendors } from '@walt/db';

import type { FastifyInstance } from 'fastify';
import type { getDb } from '../db.js';

export function registerVendorRoutes(app: FastifyInstance, db: ReturnType<typeof getDb>) {
  // GET /vendors — list all vendors with consent + message summary
  app.get('/vendors', async (_request, reply) => {
    const rows = await db
      .select({
        id: vendors.id,
        companyName: vendors.companyName,
        contactName: vendors.contactName,
        phoneE164: vendors.phoneE164,
        email: vendors.email,
        status: vendors.status,
        createdAt: vendors.createdAt,
        updatedAt: vendors.updatedAt,
      })
      .from(vendors)
      .orderBy(desc(vendors.createdAt));

    const enriched = await Promise.all(
      rows.map(async (vendor) => {
        const [latestConsent] = await db
          .select({
            consentStatus: smsConsents.consentStatus,
            createdAt: smsConsents.createdAt,
          })
          .from(smsConsents)
          .where(eq(smsConsents.vendorId, vendor.id))
          .orderBy(desc(smsConsents.createdAt))
          .limit(1);

        const [latestMessage] = await db
          .select({ createdAt: smsMessageLogs.createdAt })
          .from(smsMessageLogs)
          .where(eq(smsMessageLogs.vendorId, vendor.id))
          .orderBy(desc(smsMessageLogs.createdAt))
          .limit(1);

        return {
          ...vendor,
          latestConsentStatus: latestConsent?.consentStatus ?? null,
          lastConsentAt: latestConsent?.createdAt ?? null,
          lastMessageAt: latestMessage?.createdAt ?? null,
        };
      }),
    );

    return reply.send({ items: enriched });
  });

  // GET /vendors/:id/history — full consent history + audit trail
  app.get('/vendors/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);

    if (!vendor) return reply.status(404).send({ error: 'Vendor not found' });

    const consents = await db
      .select()
      .from(smsConsents)
      .where(eq(smsConsents.vendorId, id))
      .orderBy(desc(smsConsents.createdAt));

    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.vendorId, id))
      .orderBy(desc(auditEvents.createdAt));

    return reply.send({ vendor, consents, auditEvents: events });
  });

  // PATCH /vendors/:id/disable — admin manually blocks a vendor
  app.patch('/vendors/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string };
    const now = new Date();

    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);

    if (!vendor) return reply.status(404).send({ error: 'Vendor not found' });

    await db.update(vendors).set({ status: 'blocked', updatedAt: now }).where(eq(vendors.id, id));

    await db.insert(auditEvents).values({
      id: randomUUID(),
      vendorId: id,
      actorType: 'admin',
      actorId: null,
      eventType: 'vendor.blocked',
      metadata: { reason: 'manual_admin_disable' },
      createdAt: now,
    });

    return reply.send({ success: true });
  });
}
