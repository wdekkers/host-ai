'use client';

import { useState, type JSX } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChipInput } from '@/components/ui/chip-input';

interface NicknamesCardProps {
  propertyId: string;
  initialNicknames: string[];
}

export function NicknamesCard({
  propertyId,
  initialNicknames,
}: NicknamesCardProps): JSX.Element {
  const { getToken } = useAuth();
  const [nicknames, setNicknames] = useState<string[]>(initialNicknames);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ nicknames }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'Failed to save');
      }
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nicknames</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChipInput
          value={nicknames}
          onChange={setNicknames}
          placeholder="Add nickname (e.g. RC)"
        />
        <p className="text-sm text-muted-foreground">
          Used by AI to match property mentions in dictated tasks.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? 'Saving…' : 'Save nicknames'}
          </Button>
          {savedAt && !error && (
            <span className="text-xs text-muted-foreground">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
