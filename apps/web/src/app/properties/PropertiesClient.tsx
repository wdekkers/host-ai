'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  CheckSquare,
  BookOpen,
  Bot,
  MapPin,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Property = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  status: string | null;
  isActive: boolean;
  hasPool: boolean;
};

type Props = {
  properties: Property[];
  reservationCounts: Record<string, number>;
};

export function PropertiesClient({ properties, reservationCounts }: Props) {
  const [showInactive, setShowInactive] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [items, setItems] = useState(properties);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/sync-hospitable', { method: 'POST' });
      const json = (await res.json()) as {
        properties?: number;
        reservations?: number;
        messages?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Sync failed');
      setSyncResult(
        `Synced ${json.properties ?? 0} properties, ${json.reservations ?? 0} reservations, ${json.messages ?? 0} messages`,
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const visible = showInactive ? items : items.filter((p) => p.isActive);
  const inactiveCount = items.filter((p) => !p.isActive).length;

  const toggleActive = async (id: string, isActive: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive } : p)),
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500">
            {visible.length} propert{visible.length !== 1 ? 'ies' : 'y'}
            {inactiveCount > 0 && !showInactive && ` · ${inactiveCount} hidden`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs ${syncResult.startsWith('Synced') ? 'text-green-600' : 'text-red-600'}`}>
              {syncResult}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Hospitable'}
          </Button>
          {inactiveCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? (
                <><EyeOff className="h-4 w-4 mr-1.5" /> Hide inactive</>
              ) : (
                <><Eye className="h-4 w-4 mr-1.5" /> Show inactive ({inactiveCount})</>
              )}
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            No properties yet. Sync data from Hospitable on the Reservations page.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => {
            const count = reservationCounts[p.id] ?? 0;
            return (
              <Card
                key={p.id}
                className={`transition-opacity ${!p.isActive ? 'opacity-50' : ''}`}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {p.name}
                      </h3>
                      {(p.address || p.city) && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {[p.address, p.city].filter(Boolean).join(', ')}
                          </span>
                        </p>
                      )}
                    </div>
                    <Badge variant={p.isActive ? 'default' : 'secondary'}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <p className="text-xs text-slate-400">
                    {count} reservation{count !== 1 ? 's' : ''}
                    {p.hasPool && ' · Pool'}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-auto pt-1 border-t border-slate-100">
                    <Link href={`/inbox?propertyId=${p.id}`} title="Inbox">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Inbox className="h-4 w-4 text-slate-400" />
                      </Button>
                    </Link>
                    <Link href={`/tasks?propertyId=${p.id}`} title="Tasks">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <CheckSquare className="h-4 w-4 text-slate-400" />
                      </Button>
                    </Link>
                    <Link href={`/properties/${p.id}/knowledge`} title="Knowledge">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <BookOpen className="h-4 w-4 text-slate-400" />
                      </Button>
                    </Link>
                    <Link href={`/properties/${p.id}/agent`} title="Agent settings">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Bot className="h-4 w-4 text-slate-400" />
                      </Button>
                    </Link>
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-400"
                        disabled={togglingId === p.id}
                        onClick={() => toggleActive(p.id, !p.isActive)}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
