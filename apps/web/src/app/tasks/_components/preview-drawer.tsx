'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DictationDraftTask, TaskCategory } from '@walt/contracts';

type EditableDraft = DictationDraftTask & {
  _localId: string;
  _error?: string;
  newCategoryName?: string;
};

type PropertyOption = { id: string; name: string; nicknames?: string[] };

function PropertyCheckboxList({
  properties,
  selected,
  onChange,
}: {
  properties: PropertyOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}): React.ReactElement {
  return (
    <div className="border border-input rounded-lg divide-y max-h-40 overflow-y-auto">
      {properties.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted-foreground">No properties available</p>
      )}
      {properties.map((p) => (
        <label
          key={p.id}
          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/50"
        >
          <input
            type="checkbox"
            className="rounded"
            checked={selected.includes(p.id)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...selected, p.id]);
              } else {
                onChange(selected.filter((id) => id !== p.id));
              }
            }}
          />
          <span className="text-sm">{p.name}</span>
          {p.nicknames && p.nicknames.length > 0 && (
            <span className="text-xs text-muted-foreground">({p.nicknames.join(', ')})</span>
          )}
        </label>
      ))}
    </div>
  );
}

export function PreviewDrawer({
  open,
  onClose,
  initialDrafts,
  properties,
  categories,
  onCreated,
}: {
  open: boolean;
  onClose(): void;
  initialDrafts: DictationDraftTask[];
  properties: PropertyOption[];
  categories: TaskCategory[];
  onCreated(): void;
}): React.ReactElement {
  const [drafts, setDrafts] = useState<EditableDraft[]>(() =>
    initialDrafts.map((d, i) => ({ ...d, _localId: `draft-${i}` })),
  );
  const [busy, setBusy] = useState(false);

  // Re-initialise drafts when initialDrafts changes (drawer re-opens with new data)
  // We use a key on the Sheet instead — see parent — but also handle directly here.
  const activeDrafts = drafts.filter((d) => !d._error || d._error);

  function updateDraft(localId: string, patch: Partial<EditableDraft>): void {
    setDrafts((prev) =>
      prev.map((d) => (d._localId === localId ? { ...d, ...patch } : d)),
    );
  }

  function removeDraft(localId: string): void {
    setDrafts((prev) => prev.filter((d) => d._localId !== localId));
  }

  async function approve(): Promise<void> {
    setBusy(true);
    try {
      const payload = {
        drafts: drafts.map((d) => ({
          title: d.title,
          description: d.description ?? undefined,
          priority: d.priority,
          propertyIds: d.propertyMatches,
          categoryId: d.categoryId ?? undefined,
          dueDate: d.dueDate ?? undefined,
          newCategoryName: d.newCategoryName ?? d.suggestedNewCategory ?? undefined,
        })),
        source: 'ai-dictation' as const,
      };

      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        results: Array<{ ok: boolean; task?: unknown; error?: string }>;
      };

      const remaining: EditableDraft[] = [];
      for (let i = 0; i < drafts.length; i++) {
        const result = data.results[i];
        if (result && !result.ok) {
          remaining.push({ ...drafts[i]!, _error: result.error ?? 'Failed to create' });
        }
        // successful rows are dropped (they were created)
      }

      if (remaining.length === 0) {
        onCreated();
        onClose();
      } else {
        setDrafts(remaining);
      }
    } catch (err) {
      // Surface a top-level error by adding _error to all remaining drafts
      const msg = err instanceof Error ? err.message : 'Request failed';
      setDrafts((prev) => prev.map((d) => ({ ...d, _error: msg })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Review AI-parsed tasks</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {activeDrafts.map((draft) => (
            <Card key={draft._localId}>
              <CardContent className="pt-4 space-y-3">
                {(draft.confidence === 'low' || draft.propertyAmbiguous != null) && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {draft.propertyAmbiguous
                        ? `Ambiguous property: "${draft.propertyAmbiguous}"`
                        : 'Low confidence — please review'}
                    </span>
                  </div>
                )}

                {draft._error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                    {draft._error}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Title
                  </label>
                  <Input
                    value={draft.title}
                    onChange={(e) => updateDraft(draft._localId, { title: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Description
                  </label>
                  <Textarea
                    rows={2}
                    value={draft.description ?? ''}
                    onChange={(e) =>
                      updateDraft(draft._localId, {
                        description: e.target.value || null,
                      })
                    }
                  />
                </div>

                {/* Properties */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Properties
                    {/* TODO: upgrade to Command+Popover multi-select for better UX */}
                  </label>
                  <PropertyCheckboxList
                    properties={properties}
                    selected={draft.propertyMatches}
                    onChange={(ids) => updateDraft(draft._localId, { propertyMatches: ids })}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Category
                  </label>
                  <Select
                    value={draft.categoryId ?? (draft.newCategoryName ? '__new__' : '')}
                    onValueChange={(val) => {
                      if (val === '__new__') {
                        updateDraft(draft._localId, {
                          categoryId: null,
                          newCategoryName: draft.suggestedNewCategory ?? '',
                        });
                      } else if (val === '') {
                        updateDraft(draft._localId, { categoryId: null, newCategoryName: undefined });
                      } else {
                        updateDraft(draft._localId, { categoryId: val, newCategoryName: undefined });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {draft.suggestedNewCategory && (
                        <SelectItem value="__new__">
                          Create &ldquo;{draft.suggestedNewCategory}&rdquo;
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Priority
                  </label>
                  <Select
                    value={draft.priority}
                    onValueChange={(val) =>
                      updateDraft(draft._localId, {
                        priority: val as DictationDraftTask['priority'],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Due date */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Due date
                  </label>
                  <Input
                    type="date"
                    value={draft.dueDate ? draft.dueDate.slice(0, 10) : ''}
                    onChange={(e) =>
                      updateDraft(draft._localId, {
                        dueDate: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </div>

                {/* Delete row */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDraft(draft._localId)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-1">Remove</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {activeDrafts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              All tasks have been created or removed.
            </p>
          )}
        </div>

        <SheetFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void approve()}
            disabled={busy || activeDrafts.length === 0}
          >
            {busy ? 'Creating…' : `Approve ${activeDrafts.length}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
