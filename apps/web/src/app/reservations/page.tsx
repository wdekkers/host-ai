import { desc } from 'drizzle-orm';
import { reservations } from '@walt/db';
import { db } from '@/lib/db';

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

export default async function ReservationsPage() {
  const rows = await db
    .select()
    .from(reservations)
    .orderBy(desc(reservations.arrivalDate))
    .limit(200);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <p className="text-sm text-gray-500 mt-1">
          {rows.length} reservation{rows.length !== 1 ? 's' : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No reservations synced yet.{' '}
          <span className="block mt-1 text-sm">
            Call <code className="font-mono">POST /api/admin/sync-hospitable</code> to import your data.
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
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
                  <td className="px-6 py-4 text-sm text-gray-500">{r.propertyName ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.checkIn)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.checkOut)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{r.platform ?? '—'}</td>
                  <td className="px-6 py-4 text-sm"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
