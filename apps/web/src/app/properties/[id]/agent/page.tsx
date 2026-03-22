import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';
import { PropertyAgentSettingsForm } from '@/app/settings/agent/AgentSettingsForm';
import { PropertySettingsTabs } from '../PropertySettingsTabs';
import { AgentPageClient } from './AgentPageClient';

export default async function PropertyAgentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property] = await db
    .select({ id: properties.id, name: properties.name, city: properties.city })
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    notFound();
  }

  return (
    <AgentPageClient propertyId={property.id} propertyName={property.name}>
      <Link
        href="/properties"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1"
      >
        ← Properties
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold text-gray-900">{property.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure reply behavior for this property only. Blank fields inherit the global agent
          defaults.
        </p>
      </div>

      <PropertySettingsTabs propertyId={property.id} current="agent" />
      <PropertyAgentSettingsForm propertyId={property.id} />
    </AgentPageClient>
  );
}
