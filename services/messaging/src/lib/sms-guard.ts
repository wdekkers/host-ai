import { desc, eq } from 'drizzle-orm';

import { smsConsents, vendors } from '@walt/db';

import type { getDb } from '../db.js';

export type SmsGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'vendor_not_found'
        | 'vendor_opted_out'
        | 'vendor_blocked'
        | 'no_consent'
        | 'consent_not_opted_in';
    };

/**
 * Check whether we are allowed to send an outbound SMS to a vendor.
 * Must be called before every outbound send.
 */
export async function canSendToVendor(
  db: ReturnType<typeof getDb>,
  vendorId: string,
): Promise<SmsGuardResult> {
  const [vendor] = await db
    .select({ id: vendors.id, status: vendors.status })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) return { allowed: false, reason: 'vendor_not_found' };
  if (vendor.status === 'opted_out') return { allowed: false, reason: 'vendor_opted_out' };
  if (vendor.status === 'blocked') return { allowed: false, reason: 'vendor_blocked' };

  const [latestConsent] = await db
    .select({ consentStatus: smsConsents.consentStatus })
    .from(smsConsents)
    .where(eq(smsConsents.vendorId, vendorId))
    .orderBy(desc(smsConsents.createdAt))
    .limit(1);

  if (!latestConsent) return { allowed: false, reason: 'no_consent' };
  if (latestConsent.consentStatus !== 'opted_in')
    return { allowed: false, reason: 'consent_not_opted_in' };

  return { allowed: true };
}
