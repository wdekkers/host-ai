import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { hasPermission } from '@/lib/auth/permissions';

import { PriceLabsIntegrationClient } from './PriceLabsIntegrationClient';

export default async function PriceLabsIntegrationPage(): Promise<ReactElement | null> {
  const authContext = await getAuthContext();
  if (!authContext) {
    redirect('/sign-in');
  }

  if (!hasPermission(authContext.role, 'integrations.read')) {
    redirect('/');
  }

  const propsRows = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .orderBy(asc(properties.name));

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold mb-1">PriceLabs integration</h1>
      <p className="text-sm text-slate-600 mb-6">
        Connect your PriceLabs Customer API key and map your listings to properties.
      </p>
      <PriceLabsIntegrationClient properties={propsRows} />
    </div>
  );
}
