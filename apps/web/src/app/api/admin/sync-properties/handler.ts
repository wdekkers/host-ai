import { properties } from '@walt/db';
import { db } from '@/lib/db';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import { normalizeProperty } from '@/lib/hospitable-normalize';
import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';
import { NextResponse } from 'next/server';

type HospitableListResponse = {
  data: Record<string, unknown>[];
  meta?: { last_page?: number };
};

function hdrs(apiKey: string) {
  return { accept: 'application/json', authorization: `Bearer ${apiKey}` };
}

export const handleSyncProperties = withPermission(
  'admin.create',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_request: Request, _context: unknown) => {
    try {
      const config = getHospitableApiConfig();
      if (!config) {
        return NextResponse.json({ error: 'Hospitable not configured' }, { status: 500 });
      }

      // Step 1: Fetch all properties from list endpoint
      const all: Record<string, unknown>[] = [];
      let page = 1;

      while (true) {
        const url = new URL('/v2/properties', config.baseUrl);
        url.searchParams.set('per_page', '50');
        url.searchParams.set('page', String(page));
        const res = await fetch(url, { headers: hdrs(config.apiKey) });
        if (!res.ok) throw new Error(`Hospitable properties returned ${res.status}`);
        const body = (await res.json()) as HospitableListResponse;
        for (const p of body.data ?? []) {
          all.push(p);
        }
        const lastPage = body.meta?.last_page ?? 1;
        if (page >= lastPage) break;
        page++;
      }

      // Step 2: For each property, fetch details (includes WiFi, house manual, etc.)
      let upserted = 0;
      for (const raw of all) {
        const propId = String(raw.id);

        // Fetch individual property detail (includes the 'details' field)
        try {
          const detailUrl = new URL(`/v2/properties/${propId}`, config.baseUrl);
          const detailRes = await fetch(detailUrl, { headers: hdrs(config.apiKey) });
          if (detailRes.ok) {
            const detailBody = (await detailRes.json()) as { data?: Record<string, unknown> };
            const detail = detailBody.data ?? detailBody;
            // Merge detail fields into raw (detail response has more fields than list response)
            Object.assign(raw, detail);
          }
        } catch {
          // If detail fetch fails, continue with list data only
        }

        const normalized = normalizeProperty(raw);
        await db
          .insert(properties)
          .values({ ...normalized, syncedAt: new Date() })
          .onConflictDoUpdate({
            target: properties.id,
            set: { ...normalized, syncedAt: new Date() },
          });
        upserted++;
      }

      return NextResponse.json({
        ok: true,
        properties: upserted,
      });
    } catch (error) {
      return handleApiError({ error, route: '/api/admin/sync-properties POST' });
    }
  },
);
