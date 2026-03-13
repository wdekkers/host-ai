'use client';

import { useState } from 'react';

type Vendor = {
  id: string;
  companyName: string;
  contactName: string;
  phoneE164: string;
  status: 'invited' | 'active' | 'opted_out' | 'blocked';
  latestConsentStatus: 'opted_in' | 'opted_out' | 'pending' | null;
  lastConsentAt: string | null;
  lastMessageAt: string | null;
};

const statusBadgeClass: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  opted_out: 'bg-yellow-100 text-yellow-800',
  blocked: 'bg-red-100 text-red-800',
  invited: 'bg-gray-100 text-gray-600',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function VendorTable({ initialVendors }: { initialVendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, unknown> | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);

  const filtered = vendors.filter(
    (v) =>
      v.contactName.toLowerCase().includes(query.toLowerCase()) ||
      v.companyName.toLowerCase().includes(query.toLowerCase()) ||
      v.phoneE164.includes(query),
  );

  async function handleDisable(vendorId: string) {
    if (!confirm('Disable messaging for this vendor? This will block all outbound SMS.')) return;
    setDisabling(vendorId);
    try {
      await fetch(`/api/admin/vendors/${vendorId}/disable`, { method: 'PATCH' });
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, status: 'blocked' as const } : v)),
      );
    } finally {
      setDisabling(null);
    }
  }

  async function handleViewHistory(vendorId: string) {
    const response = await fetch(`/api/admin/vendors/${vendorId}/history`);
    const data = (await response.json()) as Record<string, unknown>;
    setSelectedId(vendorId);
    setHistory(data);
  }

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Consent</th>
              <th className="px-4 py-3 text-left">Last consent</th>
              <th className="px-4 py-3 text-left">Last message</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No vendors found
                </td>
              </tr>
            )}
            {filtered.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div>{vendor.contactName}</div>
                  {vendor.companyName && (
                    <div className="text-xs text-gray-500">{vendor.companyName}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-gray-600">{vendor.phoneE164}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass[vendor.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {vendor.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{vendor.latestConsentStatus ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(vendor.lastConsentAt)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(vendor.lastMessageAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewHistory(vendor.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      History
                    </button>
                    {vendor.status !== 'blocked' && (
                      <button
                        onClick={() => handleDisable(vendor.id)}
                        disabled={disabling === vendor.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Disable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Consent history drawer */}
      {selectedId && history && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Consent history</h2>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setHistory(null);
                }}
                className="text-xl leading-none text-gray-400 hover:text-gray-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
              {JSON.stringify(history, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
