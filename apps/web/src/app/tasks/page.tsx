'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { DictationDraftTask, TaskCategory } from '@walt/contracts';
import { DictationCard } from './_components/dictation-card';
import { PreviewDrawer } from './_components/preview-drawer';
import { TaskFilters } from './_components/task-filters';
import { TasksList } from './_components/tasks-list';

type PropertyOption = { id: string; name: string; nicknames: string[] };

export default function TasksPage(): React.ReactElement {
  const { getToken } = useAuth();
  const [drafts, setDrafts] = useState<DictationDraftTask[] | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      const [pRes, cRes] = await Promise.all([
        fetch('/api/properties', { cache: 'no-store', headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch('/api/task-categories', { cache: 'no-store', headers: { Authorization: token ? `Bearer ${token}` : '' } }),
      ]);
      if (pRes.ok) {
        const p = (await pRes.json()) as {
          items?: Array<{ id: string; name: string; nicknames?: string[] }>;
        };
        setProperties(
          (p.items ?? []).map((x) => ({ ...x, nicknames: x.nicknames ?? [] })),
        );
      }
      if (cRes.ok) {
        const c = (await cRes.json()) as { items?: TaskCategory[] };
        setCategories(c.items ?? []);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <DictationCard onParsed={(d) => setDrafts(d)} />
      <TaskFilters properties={properties} categories={categories} />
      <TasksList key={listKey} />
      <PreviewDrawer
        open={drafts !== null}
        onClose={() => setDrafts(null)}
        initialDrafts={drafts ?? []}
        properties={properties}
        categories={categories}
        onCreated={() => setListKey((k) => k + 1)}
      />
    </div>
  );
}
