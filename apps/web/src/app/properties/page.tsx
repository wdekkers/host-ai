import { count } from 'drizzle-orm';
import Link from 'next/link';
import { reservations } from '@walt/db';
import { db } from '@/lib/db';
import { getHospitableApiConfig } from '@/lib/integrations-env';

type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
};

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800'
};

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const classes = statusStyles[lower] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}

function normalizeProperty(value: unknown, index: number): Property | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const name = String(r.name ?? r.title ?? r.listing_name ?? '');
  if (!name) return null;
  const location = r.location as Record<string, unknown> | undefined;
  return {
    id: String(r.id ?? `prop-${index}`),
    name,
    address: String(r.address ?? r.street ?? ''),
    city: String(r.city ?? location?.city ?? ''),
    status: String(r.status ?? 'active'),
  };
}

async function fetchProperties(): Promise<{ items: Property[] } | { error: string }> {
  const config = getHospitableApiConfig();
  if (!config) return { error: 'not configured' };

  const url = new URL('/v2/properties?limit=100', config.baseUrl);
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` },
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Hospitable API returned ${res.status}` };

  const body = (await res.json()) as { data?: unknown[] };
  const candidates = body.data ?? [];
  const items = candidates
    .map((p, i) => normalizeProperty(p, i))
    .filter((p): p is Property => p !== null);

  return { items };
}

export default async function PropertiesPage() {
  const [propertiesResult, reservationCounts] = await Promise.all([
    fetchProperties(),
    db
      .select({ propertyId: reservations.propertyId, total: count() })
      .from(reservations)
      .groupBy(reservations.propertyId),
  ]);

  const countMap = new Map(reservationCounts.map((r) => [r.propertyId, r.total]));

  if ('error' in propertiesResult) {
    const notConfigured = propertiesResult.error === 'not configured';
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold mb-6">Properties</h1>
        <div className={`rounded-lg border p-6 ${notConfigured ? 'border-yellow-200 bg-yellow-50 text-yellow-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {notConfigured
            ? <>Integration not configured. Set <code className="font-mono text-sm">HOSPITABLE_API_KEY</code> and <code className="font-mono text-sm">HOSPITABLE_BASE_URL</code>.</>
            : `Error loading properties: ${propertiesResult.error}`}
        </div>
      </div>
    );
  }

  const properties = propertiesResult.items;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-gray-500 mt-1">
          {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No properties found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const reservationCount = countMap.get(p.id) ?? 0;
            return (
              <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-gray-900 text-sm leading-snug">{p.name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                {(p.address || p.city) && (
                  <p className="text-xs text-gray-500 mb-3">
                    {[p.address, p.city].filter(Boolean).join(', ')}
                  </p>
                )}
                <p className="text-xs text-gray-400 mb-4">{reservationCount} reservation{reservationCount !== 1 ? 's' : ''}</p>
                <div className="mt-auto flex gap-3 text-xs">
                  <Link
                    href={`/reservations?propertyId=${p.id}`}
                    className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  >
                    Reservations
                  </Link>
                  <Link
                    href={`/inbox?propertyId=${p.id}`}
                    className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  >
                    Inbox
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
