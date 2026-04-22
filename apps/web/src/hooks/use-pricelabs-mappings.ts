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
  | { state: 'not_configured' }
  | { state: 'key_invalid'; error: string }
  | { state: 'upstream_error'; error: string; code?: string; debug?: unknown }
  | { state: 'connected'; rows: MappingRow[]; hiddenCount?: number }
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

export type SaveResult = { ok: true } | { ok: false; error: string };

export function useSavePriceLabsMappings(): {
  save: (rows: MappingRow[]) => Promise<SaveResult>;
  submitting: boolean;
} {
  const [submitting, setSubmitting] = useState(false);
  const save = useCallback(async (rows: MappingRow[]): Promise<SaveResult> => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mappings: rows }),
      });
      if (res.ok) return { ok: true };
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { save, submitting };
}
