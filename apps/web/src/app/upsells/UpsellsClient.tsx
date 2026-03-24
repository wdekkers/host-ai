'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { DollarSign, Check, Activity, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PropertyFilter } from '@/components/shared/property-filter';
import { UpsellActionItem } from '@/components/upsells/upsell-action-item';
import { UpsellConfirmDialog } from '@/components/upsells/upsell-confirm-dialog';

type Upsell = {
  id: string;
  upsellType: string;
  status: string;
  estimatedRevenue: number | null;
  actualRevenue: number | null;
  offeredAt: string;
  respondedAt: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  propertyName: string | null;
  propertyId: string | null;
};

type UpsellStats = {
  totalOffered: number;
  totalAccepted: number;
  totalDeclined: number;
  estimatedRevenueOffered: number;
  actualRevenueAccepted: number;
};

type Property = { id: string; name: string };

type TabType = 'action' | 'history';

const activeTabClass =
  'rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white';
const inactiveTabClass =
  'rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50';

function formatUpsellType(type: string): string {
  switch (type) {
    case 'gap_night':
      return 'Gap Night';
    case 'early_checkin':
      return 'Early Check-in';
    case 'late_checkout':
      return 'Late Check-out';
    default:
      return type
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default';
    case 'declined':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function UpsellsClient(): React.JSX.Element {
  const { getToken } = useAuth();
  const [upsells, setUpsells] = useState<Upsell[]>([]);
  const [stats, setStats] = useState<UpsellStats | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [tab, setTab] = useState<TabType>('action');
  const [loading, setLoading] = useState(true);
  const [confirmUpsell, setConfirmUpsell] = useState<Upsell | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchProperties = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch('/api/properties', { headers });
    if (res.ok) {
      const data = (await res.json()) as { items: Property[] };
      setProperties(data.items ?? []);
    }
  }, [authHeader]);

  const fetchUpsells = useCallback(async () => {
    const headers = await authHeader();
    const params = new URLSearchParams();
    if (propertyFilter !== 'all') params.set('propertyId', propertyFilter);

    const res = await fetch(`/api/upsells?${params.toString()}`, { headers });
    if (res.ok) {
      const data = (await res.json()) as Upsell[];
      setUpsells(data);
    }
  }, [authHeader, propertyFilter]);

  const fetchStats = useCallback(async () => {
    const headers = await authHeader();
    const params = new URLSearchParams({ month: currentMonth() });
    if (propertyFilter !== 'all') params.set('propertyId', propertyFilter);

    const res = await fetch(`/api/upsells/stats?${params.toString()}`, { headers });
    if (res.ok) {
      const data = (await res.json()) as UpsellStats;
      setStats(data);
    }
  }, [authHeader, propertyFilter]);

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([fetchUpsells(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchUpsells, fetchStats]);

  const handleConfirmOpen = (id: string) => {
    const upsell = upsells.find((u) => u.id === id) ?? null;
    setConfirmUpsell(upsell);
    setDialogOpen(true);
  };

  const handleConfirm = async (id: string, actualRevenue: number) => {
    const headers = await authHeader();
    const res = await fetch(`/api/upsells/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted', actualRevenue }),
    });
    if (res.ok) {
      setDialogOpen(false);
      setConfirmUpsell(null);
      void fetchUpsells();
      void fetchStats();
    }
  };

  const actionItems = upsells.filter((u) => u.status === 'accepted' && !u.actualRevenue);

  const acceptanceRate =
    stats && stats.totalOffered > 0
      ? Math.round((stats.totalAccepted / stats.totalOffered) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Upsells</h1>
        <PropertyFilter
          properties={properties}
          value={propertyFilter}
          onChange={setPropertyFilter}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <DollarSign className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '—' : `$${stats?.actualRevenueAccepted ?? 0}`}
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Revenue This Month
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '—' : (stats?.totalAccepted ?? 0)}
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Accepted
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Activity className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '—' : (stats?.totalOffered ?? 0)}
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Total Offered
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
              <Percent className="h-4 w-4 text-slate-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '—' : `${acceptanceRate}%`}
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Acceptance Rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          className={tab === 'action' ? activeTabClass : inactiveTabClass}
          onClick={() => setTab('action')}
        >
          Needs Action ({actionItems.length})
        </button>
        <button
          className={tab === 'history' ? activeTabClass : inactiveTabClass}
          onClick={() => setTab('history')}
        >
          History
        </button>
      </div>

      {/* Tab content */}
      {tab === 'action' && (
        <div className="flex flex-col gap-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : actionItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No upsells awaiting confirmation.
            </p>
          ) : (
            actionItems.map((upsell) => (
              <UpsellActionItem
                key={upsell.id}
                upsell={upsell}
                onConfirm={handleConfirmOpen}
              />
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : upsells.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No upsells found.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Guest
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {upsells.map((upsell) => {
                    const guestName =
                      upsell.guestFirstName || upsell.guestLastName
                        ? [upsell.guestFirstName, upsell.guestLastName]
                            .filter(Boolean)
                            .join(' ')
                        : 'Unknown Guest';
                    return (
                      <tr key={upsell.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{guestName}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {upsell.propertyName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatUpsellType(upsell.upsellType)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusBadgeVariant(upsell.status)}>
                            {upsell.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {upsell.actualRevenue != null
                            ? `$${upsell.actualRevenue}`
                            : upsell.estimatedRevenue != null
                              ? `~$${upsell.estimatedRevenue}`
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDate(upsell.offeredAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      <UpsellConfirmDialog
        upsell={
          confirmUpsell
            ? {
                id: confirmUpsell.id,
                upsellType: confirmUpsell.upsellType,
                estimatedRevenue: confirmUpsell.estimatedRevenue,
              }
            : null
        }
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setConfirmUpsell(null);
        }}
        onConfirm={(id, revenue) => {
          void handleConfirm(id, revenue);
        }}
      />
    </div>
  );
}
