import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';
import { PropertySettingsTabs } from '../PropertySettingsTabs';
import { AppliancesClient } from './AppliancesClient';

export default async function PropertyAppliancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property] = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link
        href="/properties"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1"
      >
        ← Properties
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold text-gray-900">{property.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track appliances, equipment, and their model numbers for warranty claims and reordering.
        </p>
      </div>

      <PropertySettingsTabs propertyId={property.id} current="appliances" />
      <AppliancesClient propertyId={property.id} />
    </div>
  );
}
