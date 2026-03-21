'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SyncPropertiesButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function sync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/sync-hospitable', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        properties?: number;
        reservations?: number;
      };

      if (!res.ok || body.error) {
        setError(body.error ?? 'Sync failed. Check your Hospitable API key.');
        return;
      }

      setResult(
        `Synced ${body.properties ?? 0} properties and ${body.reservations ?? 0} reservations.`,
      );
      // Refresh the page to re-check for Frisco properties
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-slate-500">
        No Frisco properties found yet. Sync your property data from Hospitable to get started.
      </p>
      <Button onClick={() => void sync()} disabled={loading} variant="default">
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing...' : 'Sync Property Data'}
      </Button>
      {result && <p className="text-sm text-green-600">{result}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
