'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskCategory } from '@walt/contracts';

type PropertyOption = { id: string; name: string; nicknames?: string[] };

export function TaskFilters({
  properties,
  categories,
}: {
  properties: PropertyOption[];
  categories: TaskCategory[];
}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Local state for debounced search
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to push updated params
  const pushParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        next.delete(key);
        if (Array.isArray(value)) {
          for (const v of value) next.append(key, v);
        } else if (value !== null && value !== '') {
          next.set(key, value);
        }
      }
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  // Debounced text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: q || null });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, pushParams]);

  // Property multi-select (checkbox list in a small panel)
  const selectedProperties = params.getAll('property');
  const selectedCategories = params.getAll('category');

  function toggleMulti(key: 'property' | 'category', id: string): void {
    const current = params.getAll(key);
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    const qs = new URLSearchParams(params.toString());
    qs.delete(key);
    for (const v of next) qs.append(key, v);
    router.replace(`${pathname}?${qs.toString()}`);
  }

  function setSingle(key: string, value: string | null): void {
    pushParams({ [key]: value || null });
  }

  const statusVal = params.get('status') ?? '';
  const priorityVal = params.get('priority') ?? '';
  const dueFrom = params.get('dueFrom') ?? '';
  const dueTo = params.get('dueTo') ?? '';

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search */}
      <div className="flex-1 min-w-[180px]">
        <Input
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Property multi-select */}
      {properties.length > 0 && (
        <details className="relative">
          <summary className="cursor-pointer text-sm border border-input rounded-lg px-3 py-2 bg-transparent hover:bg-accent/50 select-none list-none flex items-center gap-1.5">
            {selectedProperties.length > 0
              ? `${selectedProperties.length} propert${selectedProperties.length === 1 ? 'y' : 'ies'}`
              : 'All properties'}
          </summary>
          <div className="absolute z-20 mt-1 w-56 bg-popover border border-input rounded-lg shadow-md p-1 max-h-48 overflow-y-auto">
            {properties.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedProperties.includes(p.id)}
                  onChange={() => toggleMulti('property', p.id)}
                />
                <span className="flex-1 truncate">{p.name}</span>
                {p.nicknames && p.nicknames.length > 0 && (
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {p.nicknames[0]}
                  </span>
                )}
              </label>
            ))}
          </div>
        </details>
      )}

      {/* Category multi-select */}
      {categories.length > 0 && (
        <details className="relative">
          <summary className="cursor-pointer text-sm border border-input rounded-lg px-3 py-2 bg-transparent hover:bg-accent/50 select-none list-none flex items-center gap-1.5">
            {selectedCategories.length > 0
              ? `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'}`
              : 'All categories'}
          </summary>
          <div className="absolute z-20 mt-1 w-48 bg-popover border border-input rounded-lg shadow-md p-1 max-h-48 overflow-y-auto">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleMulti('category', c.id)}
                />
                <span className="flex-1 truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </details>
      )}

      {/* Status */}
      <Select value={statusVal} onValueChange={(v) => setSingle('status', v)}>
        <SelectTrigger>
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>

      {/* Priority */}
      <Select value={priorityVal} onValueChange={(v) => setSingle('priority', v)}>
        <SelectTrigger>
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All priorities</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Due from */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Due from</label>
        <Input
          type="date"
          value={dueFrom}
          onChange={(e) => setSingle('dueFrom', e.target.value)}
          className="w-36"
        />
      </div>

      {/* Due to */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Due to</label>
        <Input
          type="date"
          value={dueTo}
          onChange={(e) => setSingle('dueTo', e.target.value)}
          className="w-36"
        />
      </div>
    </div>
  );
}
