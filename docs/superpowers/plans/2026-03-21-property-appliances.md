# Property Appliances & Equipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Appliances" tab to each property's detail page that tracks appliances/equipment with model numbers, serial numbers, warranty info, and notes.

**Architecture:** New `propertyAppliances` DB table, CRUD API at `/api/appliances`, new property sub-page at `/properties/[id]/appliances` with a client component. Follows existing inventory API and property detail page patterns.

**Tech Stack:** Next.js 15, Drizzle ORM, PostgreSQL, shadcn/ui, Tailwind v4, Zod, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-21-property-appliances-design.md`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `packages/contracts/src/auth.ts` | Add `appliances.*` permission values |
| Modify | `apps/web/src/lib/auth/permissions.ts` | Add role mappings + route mapping for appliances |
| Modify | `packages/db/src/schema.ts` | Add `propertyAppliances` table definition |
| Create | `packages/db/drizzle/0021_appliances.sql` | SQL migration |
| Create | `apps/web/src/app/api/appliances/route.ts` | GET (list) + POST (create) |
| Create | `apps/web/src/app/api/appliances/[applianceId]/route.ts` | PATCH (update) + DELETE |
| Create | `apps/web/src/app/api/appliances/handler.ts` | Business logic handlers |
| Modify | `apps/web/src/app/properties/[id]/PropertySettingsTabs.tsx` | Add "Appliances" tab |
| Create | `apps/web/src/app/properties/[id]/appliances/page.tsx` | Server component for appliances tab |
| Create | `apps/web/src/app/properties/[id]/appliances/AppliancesClient.tsx` | Client component with full UI |

---

## Task 1: Add Permissions

**Files:**
- Modify: `packages/contracts/src/auth.ts:30-34`
- Modify: `apps/web/src/lib/auth/permissions.ts:5-73,126-138`

- [ ] **Step 1: Add permission values to contracts**

In `packages/contracts/src/auth.ts`, add after the `// Inventory` block (line 34):

```typescript
  // Appliances
  'appliances.read',
  'appliances.create',
  'appliances.update',
  'appliances.delete',
```

- [ ] **Step 2: Add role mappings in permissions.ts**

In `apps/web/src/lib/auth/permissions.ts`:

Add to `manager` set (after `inventory.delete`):
```typescript
    'appliances.read',
    'appliances.create',
    'appliances.update',
    'appliances.delete',
```

Add to `agent` set (after `inventory.delete`):
```typescript
    'appliances.read',
```

Add to `cleaner` set (after `inventory.update`):
```typescript
    'appliances.read',
```

- [ ] **Step 3: Add route mapping in getPermissionForApiRoute**

In `apps/web/src/lib/auth/permissions.ts`, add a new block before the `// Properties` block (line 126) to keep route groups organized alphabetically:

```typescript
  // Appliances
  if (pathname.startsWith('/api/appliances')) {
    if (method === 'GET') return 'appliances.read';
    if (method === 'POST') return 'appliances.create';
    if (method === 'PATCH' || method === 'PUT') return 'appliances.update';
    if (method === 'DELETE') return 'appliances.delete';
    return 'appliances.read';
  }
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web --filter=@walt/contracts`
Expected: All tasks pass

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/auth.ts apps/web/src/lib/auth/permissions.ts
git commit -m "feat: add appliances permission group"
```

---

## Task 2: Database Schema + Migration

**Files:**
- Modify: `packages/db/src/schema.ts:725` (append after inventoryItems)
- Create: `packages/db/drizzle/0021_appliances.sql`

- [ ] **Step 1: Add table definition to schema.ts**

Append after the `inventoryItems` table definition (after line 725):

```typescript
// --- Property Appliances ---

export const propertyAppliances = waltSchema.table('property_appliances', {
  id: uuid('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  propertyId: text('property_id').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  modelNumber: text('model_number'),
  serialNumber: text('serial_number'),
  location: text('location'),
  purchaseDate: timestamp('purchase_date', { withTimezone: true }),
  warrantyExpiration: timestamp('warranty_expiration', { withTimezone: true }),
  photoUrl: text('photo_url'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('property_appliances_property_id_active_idx').on(table.propertyId, table.isActive),
]);
```

- [ ] **Step 2: Create migration file**

Create `packages/db/drizzle/0021_appliances.sql`:

```sql
CREATE TABLE IF NOT EXISTS walt.property_appliances (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model_number TEXT,
  serial_number TEXT,
  location TEXT,
  purchase_date TIMESTAMPTZ,
  warranty_expiration TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_appliances_property_id_active_idx
  ON walt.property_appliances (property_id, is_active);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/db`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0021_appliances.sql
git commit -m "feat: add propertyAppliances table and migration"
```

---

## Task 3: API Handlers

**Files:**
- Create: `apps/web/src/app/api/appliances/handler.ts`

Per CLAUDE.md: route files only export HTTP method handlers. Business logic goes in `handler.ts`.

- [ ] **Step 1: Write handler.ts**

Create `apps/web/src/app/api/appliances/handler.ts`:

```typescript
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';

import type { AuthContext } from '@walt/contracts';
import { db } from '@/lib/db';
import { propertyAppliances } from '@walt/db';

const createSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiration: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  warrantyExpiration: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function handleList(request: Request, authContext: AuthContext) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }

  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const conditions = [
    eq(propertyAppliances.propertyId, propertyId),
    eq(propertyAppliances.organizationId, authContext.orgId),
  ];
  if (!includeInactive) {
    conditions.push(eq(propertyAppliances.isActive, true));
  }

  const appliances = await db
    .select()
    .from(propertyAppliances)
    .where(and(...conditions));

  return NextResponse.json({ appliances });
}

export async function handleCreate(request: Request, authContext: AuthContext) {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const id = randomUUID();
  const { purchaseDate, warrantyExpiration, ...rest } = parsed.data;

  await db.insert(propertyAppliances).values({
    id,
    organizationId: authContext.orgId,
    ...rest,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    warrantyExpiration: warrantyExpiration ? new Date(warrantyExpiration) : null,
  });

  return NextResponse.json({ id }, { status: 201 });
}

export async function handleUpdate(
  request: Request,
  applianceId: string,
  authContext: AuthContext,
) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const data = parsed.data;

  if (data.name !== undefined) updates.name = data.name;
  if (data.brand !== undefined) updates.brand = data.brand;
  if (data.modelNumber !== undefined) updates.modelNumber = data.modelNumber;
  if (data.serialNumber !== undefined) updates.serialNumber = data.serialNumber;
  if (data.location !== undefined) updates.location = data.location;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.purchaseDate !== undefined) {
    updates.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
  }
  if (data.warrantyExpiration !== undefined) {
    updates.warrantyExpiration = data.warrantyExpiration ? new Date(data.warrantyExpiration) : null;
  }

  const [updated] = await db
    .update(propertyAppliances)
    .set(updates)
    .where(
      and(
        eq(propertyAppliances.id, applianceId),
        eq(propertyAppliances.organizationId, authContext.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Appliance not found' }, { status: 404 });
  }

  return NextResponse.json({ appliance: updated });
}

export async function handleDelete(applianceId: string, authContext: AuthContext) {
  const [deleted] = await db
    .delete(propertyAppliances)
    .where(
      and(
        eq(propertyAppliances.id, applianceId),
        eq(propertyAppliances.organizationId, authContext.orgId),
      ),
    )
    .returning({ id: propertyAppliances.id });

  if (!deleted) {
    return NextResponse.json({ error: 'Appliance not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/appliances/handler.ts
git commit -m "feat: add appliances API handlers"
```

---

## Task 4: API Route Files

**Files:**
- Create: `apps/web/src/app/api/appliances/route.ts`
- Create: `apps/web/src/app/api/appliances/[applianceId]/route.ts`

- [ ] **Step 1: Create list + create route**

Create `apps/web/src/app/api/appliances/route.ts`:

```typescript
import { withPermission } from '@/lib/auth/authorize';
import { handleList, handleCreate } from './handler';

export const GET = withPermission('appliances.read', async (request, _context, authContext) => {
  return handleList(request, authContext);
});

export const POST = withPermission('appliances.create', async (request, _context, authContext) => {
  return handleCreate(request, authContext);
});
```

- [ ] **Step 2: Create update + delete route**

Create `apps/web/src/app/api/appliances/[applianceId]/route.ts`:

```typescript
import { withPermission } from '@/lib/auth/authorize';
import { handleUpdate, handleDelete } from '../handler';

type Params = { params: Promise<{ applianceId: string }> };

export const PATCH = withPermission('appliances.update', async (request, context: Params, authContext) => {
  const { applianceId } = await context.params;
  return handleUpdate(request, applianceId, authContext);
});

export const DELETE = withPermission('appliances.delete', async (_request, context: Params, authContext) => {
  const { applianceId } = await context.params;
  return handleDelete(applianceId, authContext);
});
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/appliances/route.ts apps/web/src/app/api/appliances/\[applianceId\]/route.ts
git commit -m "feat: add appliances API routes"
```

---

## Task 5: Update PropertySettingsTabs

**Files:**
- Modify: `apps/web/src/app/properties/[id]/PropertySettingsTabs.tsx`

- [ ] **Step 1: Add appliances tab**

Update the `current` prop type and add the tab:

```typescript
import Link from 'next/link';

export function PropertySettingsTabs({
  propertyId,
  current,
}: {
  propertyId: string;
  current: 'agent' | 'knowledge' | 'appliances';
}) {
  const tabs = [
    { href: `/properties/${propertyId}/agent`, label: 'Agent' },
    { href: `/properties/${propertyId}/knowledge`, label: 'Knowledge' },
    { href: `/properties/${propertyId}/appliances`, label: 'Appliances' },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.href.endsWith(`/${current}`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/properties/\[id\]/PropertySettingsTabs.tsx
git commit -m "feat: add Appliances tab to property settings"
```

---

## Task 6: Appliances Server Page

**Files:**
- Create: `apps/web/src/app/properties/[id]/appliances/page.tsx`

- [ ] **Step 1: Create server page**

Create `apps/web/src/app/properties/[id]/appliances/page.tsx`:

```typescript
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';
import { PropertySettingsTabs } from '../PropertySettingsTabs';
import { AppliancesClient } from './AppliancesClient';

export default async function PropertyAppliancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property] = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link
        href="/properties"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1"
      >
        ← Properties
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold text-gray-900">{property.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track appliances, equipment, and their model numbers for warranty claims and reordering.
        </p>
      </div>

      <PropertySettingsTabs propertyId={property.id} current="appliances" />
      <AppliancesClient propertyId={property.id} />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: May fail because `AppliancesClient` doesn't exist yet — that's fine, we create it next.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/properties/\[id\]/appliances/page.tsx
git commit -m "feat: add appliances server page"
```

---

## Task 7: AppliancesClient Component

**Files:**
- Create: `apps/web/src/app/properties/[id]/appliances/AppliancesClient.tsx`

This is the main UI component. It handles fetching, displaying, creating, editing, and toggling appliances.

- [ ] **Step 1: Create the client component**

Create `apps/web/src/app/properties/[id]/appliances/AppliancesClient.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  X,
} from 'lucide-react';

interface Appliance {
  id: string;
  name: string;
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  location: string | null;
  purchaseDate: string | null;
  warrantyExpiration: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppliancesClientProps {
  propertyId: string;
}

const LOCATION_COLORS: Record<string, string> = {
  kitchen: 'bg-amber-100 text-amber-800',
  laundry: 'bg-purple-100 text-purple-800',
  utility: 'bg-blue-100 text-blue-800',
  garage: 'bg-slate-100 text-slate-700',
  bathroom: 'bg-teal-100 text-teal-800',
  bedroom: 'bg-pink-100 text-pink-800',
  outdoor: 'bg-green-100 text-green-800',
};

function getLocationColor(location: string): string {
  const key = location.toLowerCase();
  for (const [keyword, color] of Object.entries(LOCATION_COLORS)) {
    if (key.includes(keyword)) return color;
  }
  return 'bg-gray-100 text-gray-700';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function isWarrantyExpired(dateStr: string | null): boolean | null {
  if (!dateStr) return null;
  return new Date(dateStr) < new Date();
}

export function AppliancesClient({ propertyId }: AppliancesClientProps) {
  const { getToken } = useAuth();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    modelNumber: '',
    serialNumber: '',
    location: '',
    purchaseDate: '',
    warrantyExpiration: '',
    notes: '',
  });

  const fetchAppliances = useCallback(async () => {
    const token = await getToken();
    const params = new URLSearchParams({ propertyId });
    if (showInactive) params.set('includeInactive', 'true');
    const res = await fetch(`/api/appliances?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAppliances(data.appliances);
    }
    setLoading(false);
  }, [getToken, propertyId, showInactive]);

  useEffect(() => {
    fetchAppliances();
  }, [fetchAppliances]);

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      modelNumber: '',
      serialNumber: '',
      location: '',
      purchaseDate: '',
      warrantyExpiration: '',
      notes: '',
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken();

    const body: Record<string, string> = { ...formData };
    if (!editingId) body.propertyId = propertyId;

    // Remove empty strings
    for (const [key, val] of Object.entries(body)) {
      if (val === '') delete body[key];
    }

    const url = editingId ? `/api/appliances/${editingId}` : '/api/appliances';
    const method = editingId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      resetForm();
      fetchAppliances();
    }
  };

  const handleEdit = (appliance: Appliance) => {
    setFormData({
      name: appliance.name,
      brand: appliance.brand ?? '',
      modelNumber: appliance.modelNumber ?? '',
      serialNumber: appliance.serialNumber ?? '',
      location: appliance.location ?? '',
      purchaseDate: appliance.purchaseDate
        ? new Date(appliance.purchaseDate).toISOString().split('T')[0]
        : '',
      warrantyExpiration: appliance.warrantyExpiration
        ? new Date(appliance.warrantyExpiration).toISOString().split('T')[0]
        : '',
      notes: appliance.notes ?? '',
    });
    setEditingId(appliance.id);
    setShowForm(true);
    setMenuOpenId(null);
  };

  const handleToggleActive = async (appliance: Appliance) => {
    const token = await getToken();
    await fetch(`/api/appliances/${appliance.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: !appliance.isActive }),
    });
    setMenuOpenId(null);
    fetchAppliances();
  };

  const handleDelete = async (id: string) => {
    const token = await getToken();
    await fetch(`/api/appliances/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMenuOpenId(null);
    fetchAppliances();
  };

  const activeCount = appliances.filter((a) => a.isActive).length;
  const displayedAppliances = showInactive
    ? appliances
    : appliances.filter((a) => a.isActive);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading appliances...</p>;
  }

  return (
    <div>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {activeCount} active appliance{activeCount !== 1 ? 's' : ''}
          </span>
          <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-sky-600"
            />
            Show inactive
          </label>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-sky-600 hover:bg-sky-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Appliance
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingId ? 'Edit Appliance' : 'Add Appliance'}
              </CardTitle>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Oven / Range"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Samsung"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                    placeholder="e.g. NX60A6711SS"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="e.g. 0B7X3AKJ500123"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Kitchen, Laundry"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Warranty Expiration
                  </label>
                  <input
                    type="date"
                    value={formData.warrantyExpiration}
                    onChange={(e) =>
                      setFormData({ ...formData, warrantyExpiration: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Repair history, ordering info, replacement notes..."
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">
                  {editingId ? 'Save Changes' : 'Add Appliance'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Appliance List */}
      {displayedAppliances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">
              No appliances tracked yet. Add your first one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedAppliances.map((appliance) => {
            const expired = isWarrantyExpired(appliance.warrantyExpiration);
            return (
              <Card
                key={appliance.id}
                className={appliance.isActive ? '' : 'opacity-50'}
              >
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      {/* Name + location badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`font-semibold text-base ${
                            appliance.isActive ? 'text-gray-900' : 'line-through text-gray-500'
                          }`}
                        >
                          {appliance.name}
                        </span>
                        {appliance.location && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getLocationColor(appliance.location)}`}
                          >
                            {appliance.location}
                          </Badge>
                        )}
                        {!appliance.isActive && (
                          <Badge variant="secondary" className="bg-red-50 text-red-700 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {/* Field grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        {appliance.brand && (
                          <div>
                            <span className="text-gray-500">Brand</span>
                            <p className="font-medium text-gray-900">{appliance.brand}</p>
                          </div>
                        )}
                        {appliance.modelNumber && (
                          <div>
                            <span className="text-gray-500">Model #</span>
                            <p className="font-mono font-semibold text-gray-900">
                              {appliance.modelNumber}
                            </p>
                          </div>
                        )}
                        {appliance.serialNumber && (
                          <div>
                            <span className="text-gray-500">Serial #</span>
                            <p className="font-mono text-gray-900">{appliance.serialNumber}</p>
                          </div>
                        )}
                        {appliance.purchaseDate && (
                          <div>
                            <span className="text-gray-500">Purchased</span>
                            <p className="text-gray-900">{formatDate(appliance.purchaseDate)}</p>
                          </div>
                        )}
                        {appliance.warrantyExpiration && (
                          <div>
                            <span className="text-gray-500">Warranty expires</span>
                            <p
                              className={`font-medium ${
                                expired ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {formatDate(appliance.warrantyExpiration)}
                              {expired ? ' (expired)' : ''}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {appliance.notes && (
                        <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2 border-l-3 border-sky-600">
                          {appliance.notes}
                        </div>
                      )}
                    </div>

                    {/* Menu */}
                    <div className="relative ml-4">
                      <button
                        onClick={() =>
                          setMenuOpenId(menuOpenId === appliance.id ? null : appliance.id)
                        }
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {menuOpenId === appliance.id && (
                        <div className="absolute right-0 top-8 z-10 w-44 rounded-md bg-white shadow-lg border border-gray-200 py-1">
                          <button
                            onClick={() => handleEdit(appliance)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(appliance)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Power className="h-3.5 w-3.5" />
                            {appliance.isActive ? 'Mark Inactive' : 'Mark Active'}
                          </button>
                          <button
                            onClick={() => handleDelete(appliance.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: Pass

- [ ] **Step 3: Verify lint passes**

Run: `pnpm turbo run lint --filter=@walt/web`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/properties/\[id\]/appliances/AppliancesClient.tsx
git commit -m "feat: add appliances client component with full CRUD UI"
```

---

## Task 8: Build + Final Verification

- [ ] **Step 1: Run full typecheck + lint + build**

Run: `pnpm turbo run typecheck lint build --filter=@walt/web`
Expected: All pass

- [ ] **Step 2: Run migration on local database**

Run: `psql $DATABASE_URL -f packages/db/drizzle/0021_appliances.sql`
Expected: CREATE TABLE, CREATE INDEX

- [ ] **Step 3: Smoke test in browser**

1. Navigate to `/properties`
2. Click a property
3. See the new "Appliances" tab
4. Click it — see empty state
5. Click "Add Appliance" — fill in an oven with model number
6. Save — see it appear in the list
7. Click ⋮ → Edit — modify a field
8. Click ⋮ → Mark Inactive — see it disappear
9. Toggle "Show inactive" — see it with strikethrough
10. Click ⋮ → Mark Active — see it restored

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from smoke testing"
```
