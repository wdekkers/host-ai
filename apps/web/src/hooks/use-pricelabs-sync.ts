'use client';

import { useCallback, useState } from 'react';

export type SyncResultSummary = {
  orgCount: number;
  results: {
    orgId: string;
    status: string;
    runId?: string;
    listingsSynced?: number;
    listingsFailed?: number;
  }[];
};

export type SyncState =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'success'; summary: SyncResultSummary; at: Date }
  | { state: 'error'; error: string; at: Date };

export function useTriggerPriceLabsSync(): {
  state: SyncState;
  trigger: () => Promise<void>;
} {
  const [state, setState] = useState<SyncState>({ state: 'idle' });

  const trigger = useCallback(async () => {
    setState({ state: 'running' });
    try {
      const res = await fetch('/api/admin/pricelabs-sync', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          state: 'error',
          error: (body as { error?: string }).error ?? `HTTP ${res.status}`,
          at: new Date(),
        });
        return;
      }
      setState({ state: 'success', summary: body as SyncResultSummary, at: new Date() });
    } catch (err) {
      setState({
        state: 'error',
        error: err instanceof Error ? err.message : 'unknown',
        at: new Date(),
      });
    }
  }, []);

  return { state, trigger };
}
