import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { VendorTable } from './VendorTable';

const GATEWAY_URL =
  process.env.GATEWAY_URL ?? process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

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

async function fetchVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/vendors`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as { vendors: Vendor[] };
    return data.vendors ?? [];
  } catch {
    return [];
  }
}

export default async function AdminVendorsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const vendors = await fetchVendors();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage vendor SMS consent and messaging status.
        </p>
      </div>
      <VendorTable initialVendors={vendors} />
    </div>
  );
}
