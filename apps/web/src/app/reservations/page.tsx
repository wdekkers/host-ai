import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { reservations } from '@walt/db';
import { db } from '@/lib/db';
import SyncButton from './SyncButton';

const statusStyles: Record<string, string> = {
  booking: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  canceled: 'bg-red-100 text-red-800',
  inquiry: 'bg-blue-100 text-blue-800'
};

function StatusBadge({ status }: { status: string | null }) {
  const lower = (status ?? '').toLowerCase();
  const classes = statusStyles[lower] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {status ?? '—'}
    </span>
  );
}

function formatDate(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;

  const query = db
    .select()
    .from(reservations)
    .orderBy(desc(reservations.arrivalDate))
    .limit(200);

  const result = await (propertyId
    ? query.where(eq(reservations.propertyId, propertyId))
    : query
  ).catch((err: unknown) => ({ error: err instanceof Error ? err.message : 'Database error' }));

  if ('error' in result) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold mb-4">Reservations</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-medium">Database error</p>
          <p className="text-sm mt-1">{result.error}</p>
        </div>
      </div>
    );
  }

  const rows = result;
  const propertyName = rows[0]?.propertyName ?? null;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          {propertyId && (
            <Link href="/reservations" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1">
              ← All reservations
            </Link>
          )}
          <h1 className="text-2xl font-semibold">
            {propertyName ?? 'Reservations'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} reservation{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <SyncButton />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          {propertyId ? 'No reservations for this property.' : 'No reservations synced yet. Use the button above to import your data.'}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
            {rows.map((r) => {
              const guestName = [r.guestFirstName, r.guestLastName].filter(Boolean).join(' ') || '—';
              return (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">{guestName}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{r.propertyName ?? '—'}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
                  </p>
                  {r.platform && (
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{r.platform}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                  {!propertyId && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {[r.guestFirstName, r.guestLastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    {!propertyId && <td className="px-6 py-4 text-sm text-gray-500">{r.propertyName ?? '—'}</td>}
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.checkIn)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.checkOut)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">{r.platform ?? '—'}</td>
                    <td className="px-6 py-4 text-sm"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
