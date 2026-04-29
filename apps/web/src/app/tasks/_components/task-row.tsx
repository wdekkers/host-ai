'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Trash2, CheckCircle, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Task, TaskCategory } from '@walt/contracts';

const PRIORITY_STYLES: Record<
  Task['priority'],
  { badge: string; label: string }
> = {
  low: { badge: 'bg-muted text-muted-foreground', label: 'Low' },
  medium: { badge: 'bg-amber-100 text-amber-800', label: 'Medium' },
  high: { badge: 'bg-sky-100 text-sky-700', label: 'High' },
};

function relativeDue(dateStr: string): string {
  const now = new Date();
  const due = new Date(dateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Due yesterday';
  if (Math.abs(diffDays) <= 7) {
    return diffDays > 0 ? `Due in ${diffDays}d` : `${Math.abs(diffDays)}d overdue`;
  }
  return `Due ${due.toLocaleDateString()}`;
}

export function TaskRow({
  task,
  propertiesById,
  categoriesById,
  onChanged,
}: {
  task: Task;
  propertiesById: Map<string, { id: string; name: string }>;
  categoriesById: Map<string, TaskCategory>;
  onChanged(): void;
}): React.ReactElement {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const isResolved = task.status === 'resolved';
  const priority = PRIORITY_STYLES[task.priority];
  const category = task.categoryId ? categoriesById.get(task.categoryId) : undefined;

  async function toggleStatus(): Promise<void> {
    setBusy(true);
    try {
      const newStatus = isResolved ? 'open' : 'resolved';
      const token = await getToken();
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(): Promise<void> {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Failed to delete task');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={isResolved ? 'opacity-60' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          {/* Status toggle */}
          <button
            onClick={() => void toggleStatus()}
            disabled={busy}
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-sky-600 transition-colors"
            aria-label={isResolved ? 'Re-open task' : 'Mark resolved'}
          >
            {isResolved ? (
              <CheckCircle className="h-5 w-5 text-sky-600" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1">
            {/* Title + priority */}
            <div className="flex items-start gap-2 flex-wrap">
              <span
                className={`text-sm font-medium ${isResolved ? 'line-through text-muted-foreground' : ''}`}
              >
                {task.title}
              </span>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${priority.badge}`}
              >
                {priority.label}
              </span>
            </div>

            {/* Description preview */}
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
            )}

            {/* Meta chips */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {category && (
                <span className="bg-muted rounded px-1.5 py-0.5">{category.name}</span>
              )}
              {task.propertyIds.map((pid) => {
                const prop = propertiesById.get(pid);
                return (
                  <span
                    key={pid}
                    className="bg-sky-50 text-sky-700 rounded px-1.5 py-0.5"
                  >
                    {prop?.name ?? pid}
                  </span>
                );
              })}
              {task.dueDate && (
                <span className="text-muted-foreground">{relativeDue(task.dueDate)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Edit stub — TODO: implement inline edit in a future iteration */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void deleteTask()}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
