'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Task, TaskCategory } from '@walt/contracts';
import { TaskRow } from './task-row';

type PropertyItem = { id: string; name: string };

type Props = { propertyId?: string };

const PAGE_SIZE = 50;

export function TasksList({ propertyId }: Props): React.ReactElement {
  const params = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (propertyId) {
      q.append('property', propertyId);
    } else {
      for (const v of params.getAll('property')) q.append('property', v);
    }
    for (const v of params.getAll('category')) q.append('category', v);
    const single = ['status', 'priority', 'dueFrom', 'dueTo', 'q'] as const;
    for (const k of single) {
      const v = params.get(k);
      if (v) q.set(k, v);
    }
    q.set('limit', String(PAGE_SIZE));
    return q.toString();
  }, [params, propertyId]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [tRes, pRes, cRes] = await Promise.all([
          fetch(`/api/tasks?${query}`, { cache: 'no-store' }),
          fetch('/api/properties', { cache: 'no-store' }),
          fetch('/api/task-categories', { cache: 'no-store' }),
        ]);
        if (!tRes.ok) throw new Error(`Failed to load tasks (${tRes.status})`);
        const tData = (await tRes.json()) as { items?: Task[] };
        const pData = pRes.ok
          ? ((await pRes.json()) as { items?: PropertyItem[] })
          : { items: [] };
        const cData = cRes.ok
          ? ((await cRes.json()) as { items?: TaskCategory[] })
          : { items: [] };
        if (cancelled) return;
        setTasks(tData.items ?? []);
        setProperties(pData.items ?? []);
        setCategories(cData.items ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, refreshKey]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading tasks…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (tasks.length === 0)
    return (
      <div className="text-sm text-muted-foreground">No tasks match the current filters.</div>
    );

  const propertiesById = new Map(properties.map((p) => [p.id, p]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          propertiesById={propertiesById}
          categoriesById={categoriesById}
          onChanged={refetch}
        />
      ))}
    </div>
  );
}

export function useTasksRefresh(): { refresh(): void; signal: number } {
  const [signal, setSignal] = useState(0);
  return { signal, refresh: () => setSignal((s) => s + 1) };
}
