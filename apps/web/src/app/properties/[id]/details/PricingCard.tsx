'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePricingSnapshots } from '@/hooks/use-pricing-snapshots';
import { PricingChart } from '@/components/pricing/pricing-chart';

export function PricingCard({ propertyId }: { propertyId: string }): React.ReactElement | null {
  const { data } = usePricingSnapshots(propertyId, 90);
  if (data.state === 'loading')
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pricing — next 90 days</CardTitle>
        </CardHeader>
        <CardContent>Loading…</CardContent>
      </Card>
    );
  if (data.state === 'no_mapping') return null;
  if (data.state === 'pending')
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pricing — next 90 days</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          Waiting for first PriceLabs sync — next run at 03:00 UTC.
        </CardContent>
      </Card>
    );
  if (data.state === 'error')
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pricing — next 90 days</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-600">Couldn&apos;t load pricing: {data.error}</CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing — next 90 days</CardTitle>
      </CardHeader>
      <CardContent>
        <PricingChart days={data.days} lastSyncedAt={data.lastSyncedAt} />
      </CardContent>
    </Card>
  );
}
