'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';

type Rule = {
  id: string;
  ruleText: string;
  active: boolean;
  createdAt: string;
};

export function ScoringRulesClient(): React.ReactElement {
  const { getToken } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const headers = await authHeaders();
    const res = await fetch('/api/scoring-rules', { headers });
    if (res.ok) {
      const body = (await res.json()) as { items: Rule[] };
      setRules(body.items);
    }
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRule(): Promise<void> {
    if (!newText.trim()) return;
    setSaving(true);
    const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
    const res = await fetch('/api/scoring-rules', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ruleText: newText.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setNewText('');
      await load();
    }
  }

  async function toggleActive(rule: Rule): Promise<void> {
    const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
    await fetch(`/api/scoring-rules/${rule.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ active: !rule.active }),
    });
    await load();
  }

  async function remove(rule: Rule): Promise<void> {
    const headers = await authHeaders();
    await fetch(`/api/scoring-rules/${rule.id}`, { method: 'DELETE', headers });
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            placeholder="e.g. Guests asking for pet exceptions after the no-pets rule = red flag."
          />
          <div className="flex justify-end">
            <Button onClick={() => void addRule()} disabled={saving || newText.trim().length === 0}>
              {saving ? 'Adding…' : 'Add rule'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <ul className="divide-y">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-start gap-3 py-3">
                  <Switch checked={rule.active} onCheckedChange={() => void toggleActive(rule)} />
                  <div className="flex-1">
                    <p className={rule.active ? '' : 'text-muted-foreground line-through'}>
                      {rule.ruleText}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(rule.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => void remove(rule)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
