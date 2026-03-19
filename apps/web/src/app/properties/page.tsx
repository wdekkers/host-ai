import { asc, count } from 'drizzle-orm';
import Link from 'next/link';
import { properties, reservations } from '@walt/db';
import { db } from '@/lib/db';

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string | null }) {
  const lower = (status ?? '').toLowerCase();
  const classes = statusStyles[lower] ?? 'bg-gray-100 text-gray-800';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}
    >
      {status ?? 'unknown'}
    </span>
  );
}

export default async function PropertiesPage() {
  const [props, reservationCounts] = await Promise.all([
    db.select().from(properties).orderBy(asc(properties.name)),
    db
      .select({ propertyId: reservations.propertyId, total: count() })
      .from(reservations)
      .groupBy(reservations.propertyId),
  ]);

  const countMap = new Map(reservationCounts.map((r) => [r.propertyId, r.total]));

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-gray-500 mt-1">
          {props.length} propert{props.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {props.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No properties yet. Sync data from Hospitable on the Reservations page.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.map((p) => {
            const reservationCount = countMap.get(p.id) ?? 0;
            return (
              <div
                key={p.id}
                className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-gray-900 text-sm leading-snug">{p.name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                {(p.address || p.city) && (
                  <p className="text-xs text-gray-500 mb-3">
                    {[p.address, p.city].filter(Boolean).join(', ')}
                  </p>
                )}
                <p className="text-xs text-gray-400 mb-4">
                  {reservationCount} reservation{reservationCount !== 1 ? 's' : ''}
                </p>
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
                  <Link
                    href={`/tasks?propertyId=${p.id}`}
                    className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  >
                    Tasks
                  </Link>
                  <Link
                    href={`/properties/${p.id}/agent`}
                    className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  >
                    Agent
                  </Link>
                  <Link
                    href={`/properties/${p.id}/knowledge`}
                    className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  >
                    Knowledge
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
