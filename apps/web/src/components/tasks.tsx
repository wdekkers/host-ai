'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'open' | 'resolved' | 'deleted';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  categoryId?: string | null;
  assigneeId?: string | null;
  propertyIds: string[];
  dueDate?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  createdBy: string;
};

type TaskCategory = {
  id: string;
  name: string;
  color?: string | null;
};

type Property = {
  id: string;
  name: string;
};

// ── Priority UI helpers ───────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Priority, { border: string; badge: string; label: string }> = {
  low: { border: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-800', label: 'Low' },
  medium: {
    border: 'border-l-orange-400',
    badge: 'bg-orange-100 text-orange-800',
    label: 'Medium',
  },
  high: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-800', label: 'High' },
};

// ── TaskCard component ────────────────────────────────────────────────────────

type TaskCardProps = {
  task: Task;
  categories: TaskCategory[];
  properties: Property[];
  onToggleResolve: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

function TaskCard({
  task,
  categories,
  properties,
  onToggleResolve,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const p = PRIORITY_STYLES[task.priority];
  const isResolved = task.status === 'resolved';

  function categoryName(id: string | null | undefined) {
    return categories.find((c) => c.id === id)?.name ?? null;
  }

  function propertyName(id: string) {
    return properties.find((prop) => prop.id === id)?.name ?? id;
  }

  return (
    <div
      className={`border-l-4 ${p.border} bg-white rounded-r-lg border border-l-0 border-gray-200 p-4 flex flex-col gap-2 ${isResolved ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium text-sm ${isResolved ? 'line-through text-gray-400' : 'text-gray-900'}`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${p.badge}`}>
          {p.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
        {categoryName(task.categoryId) && (
          <span className="bg-gray-100 rounded px-1.5 py-0.5">{categoryName(task.categoryId)}</span>
        )}
        {task.propertyIds.map((pid) => (
          <span key={pid} className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
            {propertyName(pid)}
          </span>
        ))}
        {task.dueDate && (
          <span className="text-gray-400">Due {new Date(task.dueDate).toLocaleDateString()}</span>
        )}
        {isResolved && task.resolvedAt && (
          <span className="text-green-600">
            Resolved {new Date(task.resolvedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onToggleResolve(task)}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 min-h-[36px]"
        >
          {isResolved ? 'Re-open' : 'Resolve'}
        </button>
        {!isResolved && (
          <button
            onClick={() => onEdit(task)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 min-h-[36px]"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onDelete(task)}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 min-h-[36px] ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksPanel({ defaultPropertyId }: { defaultPropertyId?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterPropertyId, setFilterPropertyId] = useState(defaultPropertyId ?? '');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPropertyIds, setFormPropertyIds] = useState<string[]>(
    defaultPropertyId ? [defaultPropertyId] : [],
  );
  const [formDueDate, setFormDueDate] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280');
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterPropertyId) params.set('propertyId', filterPropertyId);
    if (filterPriority) params.set('priority', filterPriority);
    if (filterCategoryId) params.set('categoryId', filterCategoryId);
    const qs = params.toString();
    const response = await fetch(`/api/tasks${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load tasks');
    const payload = (await response.json()) as { items: Task[] };
    setTasks(payload.items);
  }, [filterPropertyId, filterPriority, filterCategoryId]);

  const fetchCategories = useCallback(async () => {
    const response = await fetch('/api/task-categories', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { items: TaskCategory[] };
    setCategories(payload.items);
  }, []);

  const fetchProperties = useCallback(async () => {
    const response = await fetch('/api/properties', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { items: Property[] };
    setProperties(payload.items);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTasks(), fetchCategories(), fetchProperties()])
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [fetchTasks, fetchCategories, fetchProperties]);

  // ── Task actions ───────────────────────────────────────────────────────────

  function openCreateForm() {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormCategoryId('');
    setFormPropertyIds(defaultPropertyId ? [defaultPropertyId] : []);
    setFormDueDate('');
    setShowForm(true);
  }

  function openEditForm(task: Task) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description ?? '');
    setFormPriority(task.priority);
    setFormCategoryId(task.categoryId ?? '');
    setFormPropertyIds(task.propertyIds);
    setFormDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setShowForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || formPropertyIds.length === 0) return;
    setError(null);
    setFormSubmitting(true);
    try {
      const body = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        priority: formPriority,
        categoryId: formCategoryId || undefined,
        propertyIds: formPropertyIds,
        dueDate: formDueDate ? new Date(formDueDate).toISOString() : undefined,
      };
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to save task');
      setShowForm(false);
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function toggleResolve(task: Task) {
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/resolve`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to update task');
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  }

  async function deleteTask(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }

  // ── Category actions ───────────────────────────────────────────────────────

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategorySubmitting(true);
    try {
      const response = await fetch('/api/task-categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), color: newCategoryColor }),
      });
      if (!response.ok) throw new Error('Failed to create category');
      setNewCategoryName('');
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function deleteCategory(cat: TaskCategory) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      const response = await fetch(`/api/task-categories/${cat.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete category');
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const openTasks = tasks.filter((t) => t.status === 'open');
  const resolvedTasks = tasks.filter((t) => t.status === 'resolved');

  // ── Main render ────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">Loading tasks…</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategories(true)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 min-h-[40px]"
            >
              Categories
            </button>
            <button
              onClick={openCreateForm}
              className="text-sm px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 text-white font-medium min-h-[40px]"
            >
              + New Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {!defaultPropertyId && (
            <select
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {openTasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
            No open tasks. Create one above.
          </div>
        )}
        {openTasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            categories={categories}
            properties={properties}
            onToggleResolve={toggleResolve}
            onEdit={openEditForm}
            onDelete={deleteTask}
          />
        ))}

        {resolvedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="text-sm text-gray-400 hover:text-gray-600 py-2 flex items-center gap-1"
            >
              <span>{showResolved ? '▼' : '▶'}</span>
              <span>
                {resolvedTasks.length} resolved task{resolvedTasks.length !== 1 ? 's' : ''}
              </span>
            </button>
            {showResolved && (
              <div className="space-y-3 mt-2">
                {resolvedTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    categories={categories}
                    properties={properties}
                    onToggleResolve={toggleResolve}
                    onEdit={openEditForm}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">{editingTask ? 'Edit Task' : 'New Task'}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={submitForm} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  placeholder="e.g. Fix broken lock on back gate"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Additional details…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormPriority(p)}
                      className={`flex-1 py-2.5 text-sm rounded-lg font-medium min-h-[44px] border-2 transition-colors ${
                        formPriority === p
                          ? `${PRIORITY_STYLES[p].badge} border-current`
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      {PRIORITY_STYLES[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setShowCategories(true);
                  }}
                  className="text-xs text-blue-600 hover:underline mt-1 min-h-[36px] py-1 flex items-center"
                >
                  Manage categories
                </button>
              </div>
              {!defaultPropertyId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Properties *
                  </label>
                  <div className="border border-gray-300 rounded-lg divide-y max-h-40 overflow-y-auto">
                    {properties.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={formPropertyIds.includes(p.id)}
                          onChange={(e) => {
                            setFormPropertyIds((prev) =>
                              e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            );
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formTitle.trim() || formPropertyIds.length === 0}
                  className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 min-h-[44px]"
                >
                  {formSubmitting ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories modal */}
      {showCategories && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold">Manage Categories</h2>
              <button
                onClick={() => setShowCategories(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No categories yet.</p>
                )}
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 py-2">
                    {cat.color && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="text-sm flex-1">{cat.name}</span>
                    <button
                      onClick={() => deleteCategory(cat)}
                      className="text-xs text-red-500 hover:text-red-700 min-h-[36px] px-2"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={createCategory} className="border-t border-gray-200 pt-4 space-y-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Color</label>
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="h-9 w-16 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={categorySubmitting || !newCategoryName.trim()}
                  className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 min-h-[44px]"
                >
                  {categorySubmitting ? 'Adding…' : 'Add category'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
