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

function headers(apiKey: string) {
  return { accept: 'application/json', authorization: `Bearer ${apiKey}` };
}

export const handleSyncProperties = withPermission(
  'admin.create',
  async (_request: Request, _context: unknown) => {
    try {
      const config = getHospitableApiConfig();
      if (!config) {
        return NextResponse.json({ error: 'Hospitable not configured' }, { status: 500 });
      }
      const all: Record<string, unknown>[] = [];
      let page = 1;

      while (true) {
        const url = new URL('/v2/properties', config.baseUrl);
        url.searchParams.set('per_page', '50');
        url.searchParams.set('page', String(page));
        const res = await fetch(url, { headers: headers(config.apiKey) });
        if (!res.ok) throw new Error(`Hospitable properties returned ${res.status}`);
        const body = (await res.json()) as HospitableListResponse;
        for (const p of body.data ?? []) {
          all.push(p);
        }
        const lastPage = body.meta?.last_page ?? 1;
        if (page >= lastPage) break;
        page++;
      }

      let upserted = 0;
      for (const raw of all) {
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
