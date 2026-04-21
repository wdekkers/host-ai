'use client';

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  usePriceLabsMappings,
  useSavePriceLabsMappings,
  type MappingRow,
} from '@/hooks/use-pricelabs-mappings';
import {
  useConnectPriceLabs,
  useDisconnectPriceLabs,
} from '@/hooks/use-pricelabs-credentials';

type PropertyOption = { id: string; name: string };

export function PriceLabsIntegrationClient({
  properties,
}: {
  properties: PropertyOption[];
}): ReactElement {
  const { data, refetch } = usePriceLabsMappings();
  const { submit, submitting } = useConnectPriceLabs();
  const { disconnect, submitting: disconnecting } = useDisconnectPriceLabs();
  const { save, submitting: saving } = useSavePriceLabsMappings();
  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, MappingRow>>({});

  const rows: MappingRow[] =
    data.state === 'connected'
      ? data.rows.map((r) => edits[r.pricelabsListingId] ?? r)
      : [];
  const dirty = useMemo(() => Object.keys(edits).length > 0, [edits]);
  const unmappedCount = rows.filter(
    (r) => r.status !== 'active' || !r.propertyId,
  ).length;

  async function onConnect(): Promise<void> {
    setConnectError(null);
    const result = await submit(apiKey);
    if (result.ok) {
      setApiKey('');
      await refetch();
    } else {
      setConnectError(result.error);
    }
  }

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

  async function onDisconnect(): Promise<void> {
    const ok = await disconnect();
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

  if (data.state === 'not_connected' || data.state === 'key_invalid') {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Connect PriceLabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.state === 'key_invalid' && (
            <p className="text-sm text-red-600">
              Last key (•••{data.fingerprint}) was rejected by PriceLabs — replace it.
            </p>
          )}
          <p className="text-sm text-slate-600">
            Paste your PriceLabs Customer API key. You can find it in PriceLabs
            Account Settings → API Details.
          </p>
          <Input
            type="password"
            placeholder="pl_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {connectError && <p className="text-sm text-red-600">{connectError}</p>}
          <Button onClick={onConnect} disabled={submitting || !apiKey.trim()}>
            {submitting ? 'Validating…' : 'Connect'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>PriceLabs listings</CardTitle>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500">Key: •••{data.fingerprint}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              disabled={disconnecting}
            >
              Disconnect
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
