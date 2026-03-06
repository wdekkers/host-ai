type Reservation = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  createdAt: string;
};

type ApiResponse = {
  error?: string;
  count?: number;
  items?: Reservation[];
};

const statusStyles: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  canceled: 'bg-red-100 text-red-800'
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

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

async function fetchReservations(): Promise<ApiResponse> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/integrations/hospitable/reservations?limit=100`, {
    cache: 'no-store'
  });
  return res.json() as Promise<ApiResponse>;
}

export default async function ReservationsPage() {
  const data = await fetchReservations();

  if (data.error?.includes('not configured')) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-6">Reservations</h1>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          Integration not configured. Set <code className="font-mono text-sm">HOSPITABLE_API_KEY</code> and{' '}
          <code className="font-mono text-sm">HOSPITABLE_BASE_URL</code> environment variables.
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-6">Reservations</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          Error loading reservations: {data.error}
        </div>
      </div>
    );
  }

  const reservations = data.items ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <p className="text-sm text-gray-500 mt-1">{reservations.length} reservation{reservations.length !== 1 ? 's' : ''}</p>
      </div>

      {reservations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No reservations found.
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.guestName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.propertyId || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.checkIn)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.checkOut)}</td>
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
