'use client';

import { useCallback, useEffect, useState } from 'react';

export type MappingRow = {
  pricelabsListingId: string;
  pricelabsListingName: string;
  propertyId: string | null;
  status: 'active' | 'unmapped' | 'inactive';
  matchConfidence: 'manual' | 'auto-high' | 'auto-low' | null;
};

export type MappingsState =
  | { state: 'loading' }
  | { state: 'not_connected' }
  | { state: 'key_invalid'; fingerprint: string }
  | { state: 'connected'; fingerprint: string; rows: MappingRow[] }
  | { state: 'error'; error: string };

export function usePriceLabsMappings(): {
  data: MappingsState;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<MappingsState>({ state: 'loading' });
  const refetch = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/integrations/pricelabs/mappings');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setData({ state: 'error', error: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const body = (await res.json()) as MappingsState;
      setData(body);
    } catch (err) {
      setData({
        state: 'error',
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }, []);
  useEffect(() => {
    void refetch();
  }, [refetch]);
  return { data, refetch };
}

export function useSavePriceLabsMappings(): {
  save: (rows: MappingRow[]) => Promise<boolean>;
  submitting: boolean;
} {
  const [submitting, setSubmitting] = useState(false);
  const save = useCallback(async (rows: MappingRow[]): Promise<boolean> => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mappings: rows }),
      });
      return res.ok;
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { save, submitting };
}
