'use client';

import { useCallback, useEffect, useState } from 'react';

export type DailySnapshot = {
  date: string;
  recommendedPrice: number;
  publishedPrice: number | null;
  isBooked: boolean;
};

export type PricingSnapshotsState =
  | { state: 'loading' }
  | { state: 'no_mapping' }
  | { state: 'pending' }
  | { state: 'ok'; listingId: string; lastSyncedAt: string | null; days: DailySnapshot[] }
  | { state: 'error'; error: string };

export function usePricingSnapshots(
  propertyId: string,
  days = 90,
): { data: PricingSnapshotsState; refetch: () => Promise<void> } {
  const [data, setData] = useState<PricingSnapshotsState>({ state: 'loading' });
  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/pricing-snapshots?days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setData({ state: 'error', error: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const body = await res.json();
      setData(body);
    } catch (err) {
      setData({ state: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  }, [propertyId, days]);
  useEffect(() => {
    void refetch();
  }, [refetch]);
  return { data, refetch };
}
