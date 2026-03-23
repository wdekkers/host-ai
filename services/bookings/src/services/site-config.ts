import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { siteConfigs } from "@walt/db";
import { createStripeClient } from "@walt/stripe";
import type { Stripe } from "@walt/stripe";

export type SiteConfig = {
  id: string;
  siteId: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  hospitableApiKey: string;
  serviceFeeRate: number;
  taxRate: number;
  damageDepositAmountCents: number;
  holdDurationMinutes: number;
  notificationEmails: string[];
};

// In-memory cache for site configs (refreshed on demand)
const configCache = new Map<string, { config: SiteConfig; stripe: Stripe; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getSiteConfig(siteId: string): Promise<SiteConfig | null> {
  const [row] = await db
    .select()
    .from(siteConfigs)
    .where(eq(siteConfigs.siteId, siteId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    siteId: row.siteId,
    stripeSecretKey: row.stripeSecretKey,
    stripeWebhookSecret: row.stripeWebhookSecret,
    hospitableApiKey: row.hospitableApiKey,
    serviceFeeRate: Number(row.serviceFeeRate) || 0.05,
    taxRate: Number(row.taxRate) || 0,
    damageDepositAmountCents: row.damageDepositAmountCents ?? 0,
    holdDurationMinutes: row.holdDurationMinutes ?? 15,
    notificationEmails: row.notificationEmails ?? [],
  };
}

export async function getSiteConfigWithStripe(
  siteId: string
): Promise<{ config: SiteConfig; stripe: Stripe } | null> {
  const now = Date.now();
  const cached = configCache.get(siteId);

  if (cached && cached.expiresAt > now) {
    return { config: cached.config, stripe: cached.stripe };
  }

  const config = await getSiteConfig(siteId);
  if (!config) return null;

  const stripe = createStripeClient(config.stripeSecretKey);

  configCache.set(siteId, {
    config,
    stripe,
    expiresAt: now + CACHE_TTL_MS,
  });

  return { config, stripe };
}

export function clearSiteConfigCache(siteId?: string): void {
  if (siteId) {
    configCache.delete(siteId);
  } else {
    configCache.clear();
  }
}
