type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
};

type ApiResponse = {
  error?: string;
  count?: number;
  items?: Property[];
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

async function fetchProperties(): Promise<ApiResponse> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/integrations/hospitable/properties?limit=100`, {
    cache: 'no-store'
  });
  return res.json() as Promise<ApiResponse>;
}

export default async function PropertiesPage() {
  const data = await fetchProperties();

  if (data.error?.includes('not configured')) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold mb-6">Properties</h1>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          Integration not configured. Set <code className="font-mono text-sm">HOSPITABLE_API_KEY</code> and{' '}
          <code className="font-mono text-sm">HOSPITABLE_BASE_URL</code> environment variables.
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold mb-6">Properties</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          Error loading properties: {data.error}
        </div>
      </div>
    );
  }

  const properties = data.items ?? [];

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-gray-500 mt-1">{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}</p>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No properties found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-gray-900 text-sm leading-snug">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              {(p.address || p.city) && (
                <p className="text-xs text-gray-500">
                  {[p.address, p.city].filter(Boolean).join(', ')}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">ID: {p.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
