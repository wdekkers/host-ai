import { eq } from 'drizzle-orm';
import { createDb, sites, siteProperties } from '@walt/db';
import type { SiteConfig } from '@walt/contracts';
import { cache } from 'react';

// Lazy DB init — avoids crash during Next.js build when DATABASE_URL isn't set
let _db: ReturnType<typeof createDb> | null = null;
function getDb(): ReturnType<typeof createDb> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    _db = createDb(url);
  }
  return _db;
}

// Simple cache with TTL
const siteCache = new Map<string, { data: SiteConfig; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): SiteConfig | null {
  const entry = siteCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    siteCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: SiteConfig): void {
  siteCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  if (siteCache.size > 100) {
    const firstKey = siteCache.keys().next().value;
    if (firstKey) siteCache.delete(firstKey);
  }
}

function rowToSiteConfig(row: typeof sites.$inferSelect): SiteConfig {
  return {
    id: row.id,
    organizationId: row.organizationId,
    slug: row.slug,
    domain: row.domain,
    templateType: row.templateType,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    ogImageUrl: row.ogImageUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    fontHeading: row.fontHeading,
    fontBody: row.fontBody,
    borderRadius: row.borderRadius,
  };
}

export async function resolveSite(domain: string): Promise<SiteConfig | null> {
  const devSiteId = process.env.DEV_SITE_ID;
  if (devSiteId) {
    const cached = getCached(`slug:${devSiteId}`);
    if (cached) return cached;
    const [row] = await getDb().select().from(sites).where(eq(sites.slug, devSiteId)).limit(1);
    if (!row) return null;
    const config = rowToSiteConfig(row);
    setCache(`slug:${devSiteId}`, config);
    return config;
  }

  const cached = getCached(`domain:${domain}`);
  if (cached) return cached;
  const [row] = await getDb().select().from(sites).where(eq(sites.domain, domain)).limit(1);
  if (!row) return null;
  const config = rowToSiteConfig(row);
  setCache(`domain:${domain}`, config);
  return config;
}

export async function getSiteProperties(siteId: string): Promise<(typeof siteProperties.$inferSelect)[]> {
  return getDb().select().from(siteProperties).where(eq(siteProperties.siteId, siteId));
}

// Deduplicate resolveSite calls per request
export const resolveSiteCached = cache(resolveSite);
