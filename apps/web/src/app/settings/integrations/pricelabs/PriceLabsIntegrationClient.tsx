'use client';

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  usePriceLabsMappings,
  useSavePriceLabsMappings,
  type MappingRow,
} from '@/hooks/use-pricelabs-mappings';
import { useTriggerPriceLabsSync } from '@/hooks/use-pricelabs-sync';

type PropertyOption = { id: string; name: string };

export function PriceLabsIntegrationClient({
  properties,
}: {
  properties: PropertyOption[];
}): ReactElement {
  const { data, refetch } = usePriceLabsMappings();
  const { save, submitting: saving } = useSavePriceLabsMappings();
  const { state: syncState, trigger: triggerSync } = useTriggerPriceLabsSync();
  const [edits, setEdits] = useState<Record<string, MappingRow>>({});

  const rows: MappingRow[] =
    data.state === 'connected'
      ? data.rows.map((r) => edits[r.pricelabsListingId] ?? r)
      : [];
  const dirty = useMemo(() => Object.keys(edits).length > 0, [edits]);
  const unmappedCount = rows.filter(
    (r) => r.status !== 'active' || !r.propertyId,
  ).length;

  function updateRow(listingId: string, patch: Partial<MappingRow>): void {
    const base =
      data.state === 'connected'
        ? data.rows.find((r) => r.pricelabsListingId === listingId)
        : undefined;
    if (!base) return;
    setEdits((prev) => ({
      ...prev,
      [listingId]: { ...base, ...prev[listingId], ...patch },
    }));
  }

  async function onSave(): Promise<void> {
    const toSave = Object.values(edits);
    const ok = await save(toSave);
    if (ok) {
      setEdits({});
      await refetch();
    }
  }

  if (data.state === 'loading') {
    return <div className="p-5 text-slate-500">Loading…</div>;
  }
  if (data.state === 'error') {
    return <div className="p-5 text-red-600">Error: {data.error}</div>;
  }

  if (data.state === 'key_invalid') {
    return (
      <Card className="max-w-xl border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">PriceLabs API key rejected</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            PriceLabs rejected the API key. Update{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">PRICELABS_API_KEY</code>{' '}
            in Secrets Manager and redeploy.
          </p>
          <p className="text-red-600">Error: {data.error}</p>
        </CardContent>
      </Card>
    );
  }

  if (data.state === 'upstream_error') {
    return (
      <Card className="max-w-xl border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800">Couldn&apos;t reach PriceLabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            {data.error}
            {data.code ? ` (code: ${data.code})` : ''}.
          </p>
          <details className="rounded bg-white/60 p-2">
            <summary className="cursor-pointer text-xs text-slate-500">Debug info</summary>
            <pre className="mt-2 overflow-auto text-xs">
              {JSON.stringify(data.debug, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    );
  }

  if (data.state === 'not_configured') {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>PriceLabs not configured</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            <code className="rounded bg-slate-100 px-1 py-0.5">PRICELABS_API_KEY</code>{' '}
            is not set in the environment.
          </p>
          <p>
            Add it to your <code className="rounded bg-slate-100 px-1 py-0.5">.env</code>{' '}
            (or Secrets Manager for production) and redeploy. Get the key from{' '}
            PriceLabs Account Settings → API Details.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>PriceLabs listings</CardTitle>
          <div className="flex items-center gap-3">
            {syncState.state === 'success' && (
              <span className="text-xs text-slate-500">
                Synced {syncState.summary.results.filter((r) => r.status === 'success').length}/
                {syncState.summary.results.length} orgs at{' '}
                {syncState.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            {syncState.state === 'error' && (
              <span className="text-xs text-red-600">Sync failed: {syncState.error}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={triggerSync}
              disabled={syncState.state === 'running'}
            >
              {syncState.state === 'running' ? 'Syncing…' : 'Sync now'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.state === 'connected' && (data.hiddenCount ?? 0) > 0 && (
            <div className="mb-4 rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
              {data.hiddenCount} listing{data.hiddenCount === 1 ? '' : 's'} filtered out
              because sync is toggled off in PriceLabs.
            </div>
          )}
          {unmappedCount > 0 && (
            <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              {unmappedCount} listing{unmappedCount === 1 ? '' : 's'} not yet mapped
              — these won&apos;t be synced.
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">PriceLabs listing</th>
                <th className="py-2">Internal property</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.pricelabsListingId}
                  className="border-t border-slate-100"
                >
                  <td className="py-2">
                    <div className="font-medium">{r.pricelabsListingName}</div>
                    <div className="text-xs text-slate-500">
                      {r.pricelabsListingId}
                    </div>
                  </td>
                  <td className="py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={r.propertyId ?? ''}
                      onChange={(e) =>
                        updateRow(r.pricelabsListingId, {
                          propertyId: e.target.value || null,
                          status: e.target.value ? 'active' : 'unmapped',
                        })
                      }
                    >
                      <option value="">— none —</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {r.matchConfidence && r.matchConfidence !== 'manual' && (
                      <span className="ml-2 text-xs text-slate-500">
                        suggested ({r.matchConfidence})
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={r.status}
                      onChange={(e) =>
                        updateRow(r.pricelabsListingId, {
                          status: e.target.value as MappingRow['status'],
                        })
                      }
                    >
                      <option value="active">active</option>
                      <option value="unmapped">unmapped</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <Button onClick={onSave} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save mappings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
