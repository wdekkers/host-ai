# Journey Engine UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete frontend for the journey engine: journeys list + detail pages, upsell dashboard, notification center with toasts, and inbox AI controls.

**Architecture:** Next.js App Router pages with client components fetching from the existing journey engine API. All new UI follows existing patterns from the Today page and Inbox. Six new shadcn components are installed first, then backend API endpoints are extended, then pages and components are built.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui (Card, Badge, Button, DropdownMenu, Dialog, Tabs, Select, Textarea, Sonner), Lucide React.

**Spec:** `docs/superpowers/specs/2026-03-24-journey-engine-ui-design.md`

---

## File Structure

### New shadcn Components (installed, not hand-written)
```
apps/web/src/components/ui/
├── dropdown-menu.tsx    # Bell dropdown, AI pause dropdown, property filter
├── dialog.tsx           # Upsell confirm dialog
├── tabs.tsx             # Upsell dashboard tabs
├── select.tsx           # Property filter, notification preferences
├── textarea.tsx         # AI prompt input, AI edit panel
└── sonner.tsx           # Toast notifications (Sonner)
```

### Backend API Modifications
```
apps/web/src/app/api/
├── journeys/handler.ts                           # Modify: add aggregate metrics via subqueries
├── journeys/[id]/handler.ts                      # Modify: add promotionSuggested flag
├── upsells/handler.ts                            # Modify: join reservations for guest names
├── upsells/stats/handler.ts                      # Modify: add propertyId + month filters
├── notifications/handler.ts                      # Modify: return unreadCount in response
└── conversations/[reservationId]/ai-status/
    └── handler.ts                                # Modify: fix pauseDurationMinutes
```

### New Pages
```
apps/web/src/app/
├── journeys/
│   ├── page.tsx                                  # Journeys list page (server component)
│   ├── JourneysClient.tsx                        # Client component with prompt, list, stats
│   └── [id]/
│       ├── page.tsx                              # Journey detail page (server component)
│       └── JourneyDetailClient.tsx               # Client: timeline, AI edit, config
├── upsells/
│   ├── page.tsx                                  # Upsell dashboard (server component)
│   └── UpsellsClient.tsx                         # Client: stats, tabs, action items
└── notifications/
    ├── page.tsx                                  # Full notifications page
    └── NotificationsClient.tsx                   # Client: filterable list
```

### New Components
```
apps/web/src/components/
├── journeys/
│   ├── journey-prompt-input.tsx                  # AI prompt hero with template picker
│   ├── journey-card.tsx                          # Journey list card
│   ├── journey-step-timeline.tsx                 # Vertical step timeline
│   ├── journey-ai-edit-panel.tsx                 # Conversational edit panel
│   ├── journey-config-card.tsx                   # Read-only config key-value card
│   └── promotion-banner.tsx                      # Approval mode upgrade suggestion
├── upsells/
│   ├── upsell-action-item.tsx                    # Accepted upsell card with CTA
│   └── upsell-confirm-dialog.tsx                 # Revenue confirmation dialog
├── notifications/
│   ├── notification-bell.tsx                     # Bell icon + dropdown
│   ├── notification-item.tsx                     # Single notification row
│   └── urgent-toast-provider.tsx                 # Global toast manager for escalations
├── inbox/
│   └── ai-status-toggle.tsx                      # Green/amber AI active/paused toggle
└── shared/
    └── property-filter.tsx                       # Reusable property dropdown filter
```

### Modified Files
```
apps/web/src/lib/nav-links.ts                     # Add Journeys + Upsells to Operations
apps/web/src/app/app-chrome.tsx                    # Add NotificationBell + UrgentToastProvider
apps/web/src/app/inbox/ConversationThread.tsx      # Add AiStatusToggle to header
apps/web/src/app/layout.tsx                        # Add Sonner Toaster
```

---

## Task 1: Install shadcn Components

**Files:**
- Create (via CLI): 6 new shadcn component files in `apps/web/src/components/ui/`

- [ ] **Step 1: Install all 6 components**

Run from `apps/web/`:
```bash
cd apps/web && npx shadcn@latest add dropdown-menu dialog tabs select textarea sonner
```

Accept defaults for all prompts.

- [ ] **Step 2: Add Sonner Toaster to root layout**

Modify `apps/web/src/app/layout.tsx` — add `<Toaster />` from `sonner` inside the body, after `{children}`:

```typescript
import { Toaster } from '@/components/ui/sonner';

// Inside the body, after {children}:
<Toaster position="bottom-right" />
```

- [ ] **Step 3: Verify build**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/ apps/web/src/app/layout.tsx
git commit -m "feat: install shadcn dropdown-menu, dialog, tabs, select, textarea, sonner"
```

---

## Task 2: Backend API Fixes

**Files:**
- Modify: `apps/web/src/app/api/journeys/handler.ts`
- Modify: `apps/web/src/app/api/journeys/[id]/handler.ts`
- Modify: `apps/web/src/app/api/upsells/handler.ts`
- Modify: `apps/web/src/app/api/upsells/stats/handler.ts`
- Modify: `apps/web/src/app/api/conversations/[reservationId]/ai-status/handler.ts`

These backend changes are required by the UI.

- [ ] **Step 1: Add aggregate metrics to journey list endpoint**

In `apps/web/src/app/api/journeys/handler.ts`, modify `handleListJourneys` to return per-journey metrics using inline subqueries (NOT N+1 queries):

```typescript
import { getTableColumns } from 'drizzle-orm';

const rows = await db
  .select({
    ...getTableColumns(journeys),
    enrollmentCount: sql<number>`(SELECT count(*) FROM walt.journey_enrollments WHERE journey_id = ${journeys.id} AND status = 'active')`.as('enrollment_count'),
    messageCount: sql<number>`(SELECT count(*) FROM walt.journey_execution_log WHERE journey_id = ${journeys.id} AND action IN ('message_drafted', 'message_sent'))`.as('message_count'),
  })
  .from(journeys)
  .where(/* existing filters */)
  .orderBy(desc(journeys.createdAt))
  .limit(50);
```

This runs as a single query with correlated subqueries — no N+1 problem.

- [ ] **Step 2: Add promotionSuggested flag to journey detail**

In `apps/web/src/app/api/journeys/[id]/handler.ts`, modify `handleGetJourney` to compute and return `promotionSuggested`:

```typescript
// After fetching the journey, if approvalMode is 'draft':
let promotionSuggested = false;
if (journey.approvalMode === 'draft') {
  const [stats] = await db
    .select({ total: count(), edited: count(/* where action = 'message_drafted' */) })
    .from(journeyExecutionLog)
    .where(eq(journeyExecutionLog.journeyId, journey.id));
  // Compute: total messages = message_drafted + message_sent actions
  // Edit rate = messages where the draft was edited before sending (approximated by counting
  // message_drafted actions that are NOT followed by message_sent for the same enrollment+step)
  // For v1, use a simpler heuristic: if total > 50 and journey has been active > 7 days
  const total = stats?.total ?? 0;
  if (total > 50) {
    promotionSuggested = true;
    // TODO: compute real edit rate from draft_events table once available
  }
}
return NextResponse.json({ ...journey, promotionSuggested });
```

- [ ] **Step 3: Add guest names to upsell list**

In `apps/web/src/app/api/upsells/handler.ts`, modify `handleListUpsells` to join with reservations:

```typescript
import { reservations } from '@walt/db';

// Join upsellEvents with reservations to get guest names
const rows = await db
  .select({
    .../* all upsellEvents columns */,
    guestFirstName: reservations.guestFirstName,
    guestLastName: reservations.guestLastName,
    propertyName: reservations.propertyName,
  })
  .from(upsellEvents)
  .leftJoin(reservations, eq(upsellEvents.reservationId, reservations.id))
  .where(eq(upsellEvents.organizationId, orgId))
  .orderBy(desc(upsellEvents.offeredAt))
  .limit(50);
```

- [ ] **Step 4: Add propertyId and month filters to upsell stats**

In `apps/web/src/app/api/upsells/stats/handler.ts`, modify `handleUpsellStats` to accept query params:

```typescript
const url = new URL(request.url);
const propertyId = url.searchParams.get('propertyId');
const month = url.searchParams.get('month'); // YYYY-MM format

// Build where conditions
const conditions = [eq(upsellEvents.organizationId, orgId)];
if (propertyId) conditions.push(eq(upsellEvents.propertyId, propertyId));
if (month) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  conditions.push(gte(upsellEvents.offeredAt, start));
  conditions.push(lt(upsellEvents.offeredAt, end));
}
```

- [ ] **Step 5: Fix pauseDurationMinutes in AI status handler**

In `apps/web/src/app/api/conversations/[reservationId]/ai-status/handler.ts`, fix the `aiPausedUntil` computation:

```typescript
const { status, pauseDurationMinutes } = parsed.data;

let aiPausedUntil: Date | null = null;
if (status === 'paused' && pauseDurationMinutes) {
  aiPausedUntil = new Date(Date.now() + pauseDurationMinutes * 60 * 1000);
}
```

Also update the `updateAiStatusInputSchema` in contracts to add `pauseDurationMinutes` while keeping the existing `conversationId` field:
```typescript
// In packages/contracts/src/journeys.ts, update the schema:
export const updateAiStatusInputSchema = z.object({
  conversationId: z.string().uuid().optional(), // kept for backward compatibility
  status: aiStatusSchema,
  pauseDurationMinutes: z.number().int().positive().nullable().optional(),
});
```

- [ ] **Step 6: Ensure notifications handler returns unreadCount**

In `apps/web/src/app/api/notifications/handler.ts`, modify `handleListNotifications` to return `{ items, unreadCount }` instead of a flat array. Add a parallel query for unread count:

```typescript
const [items, [unreadResult]] = await Promise.all([
  db.select().from(notifications).where(/* existing filters */).orderBy(desc(notifications.createdAt)).limit(50),
  db.select({ count: count() }).from(notifications).where(and(
    eq(notifications.organizationId, orgId),
    isNull(notifications.readAt),
  )),
]);
return NextResponse.json({ items, unreadCount: unreadResult?.count ?? 0 });
```

- [ ] **Step 7: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/journeys/ apps/web/src/app/api/upsells/ apps/web/src/app/api/notifications/ apps/web/src/app/api/conversations/ packages/contracts/src/journeys.ts
git commit -m "fix: extend backend APIs with metrics, guest names, filters, unreadCount, and duration support"
```

**NOTE for UI consumers:** The upsell list endpoint joins with `reservations` via `leftJoin`, so `guestFirstName`/`guestLastName` may be null for orphaned upsell events. All UI components displaying guest names must handle null gracefully (e.g., fallback to "Unknown Guest").

---

## Task 3: Navigation + Shared Components

**Files:**
- Modify: `apps/web/src/lib/nav-links.ts`
- Create: `apps/web/src/components/shared/property-filter.tsx`

- [ ] **Step 1: Add Journeys and Upsells to nav**

In `apps/web/src/lib/nav-links.ts`, add to the Operations group items array, after the Properties entry:

```typescript
import { Zap, TrendingUp } from 'lucide-react';

// In Operations group items, after Properties:
{ label: 'Journeys', href: '/journeys', icon: Zap, roles: ['owner', 'manager'] },
{ label: 'Upsells', href: '/upsells', icon: TrendingUp, roles: ['owner', 'manager'] },
```

- [ ] **Step 2: Create PropertyFilter component**

Create `apps/web/src/components/shared/property-filter.tsx`:

```tsx
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Property = { id: string; name: string };

type PropertyFilterProps = {
  properties: Property[];
  value: string;
  onChange: (value: string) => void;
};

export function PropertyFilter({ properties, value, onChange }: PropertyFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="All properties" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All properties</SelectItem>
        {properties.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/lib/nav-links.ts apps/web/src/components/shared/
git commit -m "feat: add Journeys and Upsells to navigation, create PropertyFilter"
```

---

## Task 4: Notification Bell + Toast Provider

**Files:**
- Create: `apps/web/src/components/notifications/notification-bell.tsx`
- Create: `apps/web/src/components/notifications/notification-item.tsx`
- Create: `apps/web/src/components/notifications/urgent-toast-provider.tsx`
- Modify: `apps/web/src/app/app-chrome.tsx`

- [ ] **Step 1: Create NotificationItem component**

Create `apps/web/src/components/notifications/notification-item.tsx`:

A single notification row with:
- Unread blue dot (if `readAt` is null)
- Category badge (URGENT=red, UPSELL=green, JOURNEY=amber, TASK=slate)
- Relative time
- Title (font-medium) + body (text-slate-500)
- onClick handler to mark as read + navigate

```tsx
'use client';

import { Badge } from '@/components/ui/badge';

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
  escalation: { label: 'URGENT', className: 'bg-red-50 text-red-600 border-0' },
  upsell: { label: 'UPSELL', className: 'bg-green-50 text-green-800 border-0' },
  journey: { label: 'JOURNEY', className: 'bg-amber-50 text-amber-800 border-0' },
  task: { label: 'TASK', className: 'bg-slate-100 text-slate-600 border-0' },
  system: { label: 'SYSTEM', className: 'bg-slate-100 text-slate-600 border-0' },
};

type NotificationItemProps = {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  onClick: () => void;
};

export function NotificationItem({ category, title, body, readAt, createdAt, onClick }: NotificationItemProps) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.system;
  const isUnread = !readAt;
  const timeAgo = formatRelativeTime(createdAt);

  return (
    <button
      className={`w-full text-left px-3.5 py-2.5 border-b border-slate-100 hover:bg-slate-50 ${isUnread ? 'bg-slate-50/50' : 'opacity-60'}`}
      onClick={onClick}
    >
      <div className="flex gap-2.5">
        <div className="mt-1.5 flex-shrink-0">
          {isUnread && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${style.className}`}>{style.label}</Badge>
            <span className="text-[10px] text-slate-400">{timeAgo}</span>
          </div>
          <p className="text-xs font-medium text-slate-900 truncate">{title}</p>
          <p className="text-[11px] text-slate-500 truncate">{body}</p>
        </div>
      </div>
    </button>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 2: Create NotificationBell component**

Create `apps/web/src/components/notifications/notification-bell.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationItem } from './notification-item';

type Notification = {
  id: string;
  category: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const { getToken } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const token = await getToken();
    const res = await fetch('/api/notifications?limit=8', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    const token = await getToken();
    await fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchNotifications();
  };

  const handleNotificationClick = async (id: string) => {
    const token = await getToken();
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    void fetchNotifications();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button className="relative p-1.5 rounded-md hover:bg-slate-100">
          <Bell className="h-5 w-5 text-slate-500" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white border-2 border-white">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => void handleMarkAllRead()}>
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-sm text-slate-400">No notifications</p>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                {...n}
                onClick={() => void handleNotificationClick(n.id)}
              />
            ))
          )}
        </div>
        <div className="border-t border-slate-100 px-3.5 py-2.5 text-center">
          <a href="/notifications" className="text-xs font-medium text-primary hover:underline">View all notifications</a>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Create UrgentToastProvider**

Create `apps/web/src/components/notifications/urgent-toast-provider.tsx`:

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export function UrgentToastProvider() {
  const { getToken } = useAuth();
  const seenIds = useRef(new Set<string>());

  const checkUrgent = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const token = await getToken();
    const res = await fetch('/api/notifications?category=escalation&limit=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = (data.items ?? []) as Array<{ id: string; title: string; body: string; readAt: string | null }>;

    for (const item of items) {
      if (item.readAt || seenIds.current.has(item.id)) continue;
      seenIds.current.add(item.id);
      toast.error(item.title, {
        description: item.body,
        duration: 10_000,
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      });
    }
  }, [getToken]);

  useEffect(() => {
    void checkUrgent();
    const interval = setInterval(() => void checkUrgent(), 30_000);
    return () => clearInterval(interval);
  }, [checkUrgent]);

  return null;
}
```

- [ ] **Step 4: Add to app-chrome**

In `apps/web/src/app/app-chrome.tsx`, import and render NotificationBell in the header bar (next to SidebarTrigger), and UrgentToastProvider inside the main content area:

```typescript
import { NotificationBell } from '@/components/notifications/notification-bell';
import { UrgentToastProvider } from '@/components/notifications/urgent-toast-provider';

// Restructure the header to have left (SidebarTrigger) and right (bell + user) sides:
// The header currently only has SidebarTrigger. Add a flex spacer and right-side controls.
<header className="flex h-12 items-center justify-between border-b border-border px-4">
  <SidebarTrigger />
  <div className="flex items-center gap-3">
    <NotificationBell />
    {/* Note: UserButton is currently in the sidebar footer. Consider whether
        to keep it there or move it to the header. For now, bell goes in header only. */}
  </div>
</header>

// Inside SidebarInset, after the header:
<UrgentToastProvider />
```

- [ ] **Step 5: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/components/notifications/ apps/web/src/app/app-chrome.tsx apps/web/src/app/layout.tsx
git commit -m "feat: add notification bell, dropdown, and urgent toast provider"
```

---

## Task 5: AI Status Toggle for Inbox

**Files:**
- Create: `apps/web/src/components/inbox/ai-status-toggle.tsx`
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx`

- [ ] **Step 1: Create AiStatusToggle component**

Create `apps/web/src/components/inbox/ai-status-toggle.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AiStatusToggleProps = {
  reservationId: string;
  initialStatus?: 'active' | 'paused';
};

export function AiStatusToggle({ reservationId, initialStatus = 'active' }: AiStatusToggleProps) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState(initialStatus);

  const updateStatus = async (newStatus: 'active' | 'paused', durationMinutes?: number) => {
    const token = await getToken();
    await fetch(`/api/conversations/${reservationId}/ai-status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        pauseDurationMinutes: durationMinutes ?? null,
      }),
    });
    setStatus(newStatus);
  };

  if (status === 'paused') {
    return (
      <button
        className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5"
        onClick={() => void updateStatus('active')}
      >
        <div className="h-2 w-2 rounded-full bg-amber-500" />
        <span className="text-xs font-medium text-amber-800">AI Paused</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-green-800">AI Active</span>
          <ChevronDown className="h-3 w-3 text-green-700" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold text-slate-900">Pause AI for this conversation</p>
        </div>
        <DropdownMenuItem onClick={() => void updateStatus('paused', 15)}>15 minutes</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void updateStatus('paused', 60)}>1 hour</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void updateStatus('paused', 1440)}>24 hours</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void updateStatus('paused')}>Until I resume</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Add toggle to ConversationThread header**

In `apps/web/src/app/inbox/ConversationThread.tsx`, in the conversation header area (where guest name, status badge, and reservation info are displayed), add the toggle:

```typescript
import { AiStatusToggle } from '@/components/inbox/ai-status-toggle';

// In the header, right side (next to or below the reservation info):
<AiStatusToggle reservationId={reservationId} />
```

Find the exact location by looking for the guest name display and status badge in the component, and place the toggle on the right side of that header row.

- [ ] **Step 3: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/components/inbox/ apps/web/src/app/inbox/ConversationThread.tsx
git commit -m "feat: add AI status toggle to inbox conversation header"
```

---

## Task 6: Journey Components

**Files:**
- Create: `apps/web/src/components/journeys/journey-prompt-input.tsx`
- Create: `apps/web/src/components/journeys/journey-card.tsx`
- Create: `apps/web/src/components/journeys/journey-step-timeline.tsx`
- Create: `apps/web/src/components/journeys/journey-ai-edit-panel.tsx`
- Create: `apps/web/src/components/journeys/journey-config-card.tsx`
- Create: `apps/web/src/components/journeys/promotion-banner.tsx`

- [ ] **Step 1: Create JourneyPromptInput**

AI prompt hero component with textarea, template picker, and generate button. Uses `Textarea` from shadcn, `Sparkles` icon, `Button` primary. Template picker uses `DropdownMenu` with pre-built prompts.

- [ ] **Step 2: Create JourneyCard**

Card component for the journey list. Displays name, description, status badge, approval mode badge, properties, and metrics row. Uses `Card`, `Badge`, Lucide icons (`Zap`, `ListChecks`, `Users`, `Mail`, `Pencil`, `DollarSign`). Clickable — wraps in `Link` to `/journeys/[id]`.

- [ ] **Step 3: Create JourneyStepTimeline**

Vertical timeline showing steps with numbered, color-coded circles:
- `send_message` / `upsell_offer`: sky blue
- `wait`: amber
- `ai_decision`: purple
- `create_task`: green
- `send_notification`: slate
- `pause_ai` / `resume_ai`: amber

Each step shows type label, timing badge, and directive text in quotes.

- [ ] **Step 4: Create JourneyAiEditPanel**

Card with textarea for conversational editing. Placeholder text, "Apply Changes" button. On submit, POST to `/api/journeys/generate/edit` with journeyId + instruction, shows loading state, then updates the parent with new steps.

- [ ] **Step 5: Create JourneyConfigCard**

Read-only Card with `divide-y` rows: Trigger, Properties, Approval Mode, Coverage, Version. Each row is key (text-slate-500) + value (font-medium). Approval mode row includes upgrade link when `promotionSuggested` is true.

- [ ] **Step 6: Create PromotionBanner**

Amber Card with `Info` icon, title "Ready for auto mode?", body text with metrics, and two buttons: "Upgrade to Auto" (amber primary) + "Not now" (outline). On click, PUT to `/api/journeys/[id]` with `approvalMode: 'auto_with_exceptions'`.

- [ ] **Step 7: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/components/journeys/
git commit -m "feat: add journey UI components (prompt, card, timeline, edit, config, promotion)"
```

---

## Task 7: Journeys List Page

**Files:**
- Create: `apps/web/src/app/journeys/page.tsx`
- Create: `apps/web/src/app/journeys/JourneysClient.tsx`

- [ ] **Step 1: Create server page component**

`apps/web/src/app/journeys/page.tsx` — server component that renders `JourneysClient`.

- [ ] **Step 2: Create client component**

`apps/web/src/app/journeys/JourneysClient.tsx`:
- Fetches journeys from `/api/journeys`
- Layout: `space-y-5`
- Heading: "Journeys" + subtitle
- `JourneyPromptInput` hero section
- Stat cards grid (`grid grid-cols-2 gap-3 sm:grid-cols-4`) — Active, Paused, Messages Sent, Approval Rate (computed from journey list data)
- Filter tabs (All, Active, Paused, Draft) — client-side filtering
- Journey cards list using `JourneyCard` component
- Empty state when no journeys: just the prompt input with encouraging text

On generate success: `router.push('/journeys/[newId]')` to navigate to the detail page.

- [ ] **Step 3: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/app/journeys/
git commit -m "feat: add journeys list page with AI prompt input"
```

---

## Task 8: Journey Detail Page

**Files:**
- Create: `apps/web/src/app/journeys/[id]/page.tsx`
- Create: `apps/web/src/app/journeys/[id]/JourneyDetailClient.tsx`

- [ ] **Step 1: Create server page component**

Fetches journey by ID from `/api/journeys/[id]`.

- [ ] **Step 2: Create client component**

Asymmetric two-column layout (`grid grid-cols-1 lg:grid-cols-5 gap-4`) — left column `col-span-3` for the timeline (wider, can be long), right column `col-span-2` for config cards:
- **Left**: `JourneyStepTimeline` with steps from journey data
- **Right**: `JourneyAiEditPanel` + `JourneyConfigCard` + `PromotionBanner` (if `promotionSuggested`)

Header with back link, journey name, badges, Pause/Archive buttons.
Stat cards row with enrollment count, message count, edit rate, completed count.

- [ ] **Step 3: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/app/journeys/[id]/
git commit -m "feat: add journey detail page with step timeline and AI edit"
```

---

## Task 9: Upsell Components + Dashboard Page

**Files:**
- Create: `apps/web/src/components/upsells/upsell-action-item.tsx`
- Create: `apps/web/src/components/upsells/upsell-confirm-dialog.tsx`
- Create: `apps/web/src/app/upsells/page.tsx`
- Create: `apps/web/src/app/upsells/UpsellsClient.tsx`

- [ ] **Step 1: Create UpsellActionItem**

Card row component: green check icon, "[Guest] accepted [type]" title, property + dates details, "Confirm & Log Revenue" button. Uses `Badge` for status.

- [ ] **Step 2: Create UpsellConfirmDialog**

`Dialog` component with:
- Offer details display (type, property, estimated amount)
- Revenue input (pre-filled with estimate, editable)
- "Confirm" button — calls PUT `/api/upsells/[id]`
- "Cancel" button

- [ ] **Step 3: Create UpsellsClient page**

Layout:
- Heading + `PropertyFilter`
- Revenue stat cards (4-col grid): Revenue This Month (`DollarSign`), Accepted (`Check`), Total Offered (`Activity`), Acceptance Rate (`Percent`)
- Tabs component: "Needs Action" / "History"
- Needs Action tab: list of `UpsellActionItem` components (filtered to `status: 'accepted'`)
- History tab: table/card list of all upsell events with status/type/property filters
- Responsive: table on desktop, cards on mobile (matching Reservations pattern)

Fetches from `/api/upsells` and `/api/upsells/stats` (with propertyId + month params from filter).

- [ ] **Step 4: Create server page component**

- [ ] **Step 5: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/components/upsells/ apps/web/src/app/upsells/
git commit -m "feat: add upsell dashboard with revenue stats and action items"
```

---

## Task 10: Notifications Full Page

**Files:**
- Create: `apps/web/src/app/notifications/page.tsx`
- Create: `apps/web/src/app/notifications/NotificationsClient.tsx`

- [ ] **Step 1: Create notifications page**

Full page view of all notifications with:
- Heading: "Notifications"
- Filter by category (dropdown)
- "Mark all read" button
- List of `NotificationItem` components (paginated, load more)
- Link to preferences page (gear icon in header)

Fetches from `/api/notifications` with pagination.

- [ ] **Step 2: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/app/notifications/
git commit -m "feat: add full notifications page"
```

---

## Task 10b: Notification Preferences Page

**Files:**
- Create: `apps/web/src/app/settings/notifications/page.tsx`
- Create: `apps/web/src/app/settings/notifications/NotificationPreferencesClient.tsx`

- [ ] **Step 1: Create notification preferences page**

A settings sub-page at `/settings/notifications` (alongside existing `/settings/agent`):

- Heading: "Notification Preferences"
- List of categories: Escalation, Upsell, Task, Journey, System
- For each category: multi-select of channels using checkboxes (SMS, Email, Slack, Web)
- Quiet hours section: toggle + timezone select + start/end hour selects
- Save button per category (or single save for all)
- Follow the existing `AgentSettingsForm.tsx` pattern for form layout

Fetches from GET `/api/notifications/preferences`, saves with PUT `/api/notifications/preferences`.

- [ ] **Step 2: Add to settings tabs**

If a settings tab component exists (e.g., `SettingsTabs.tsx`), add a "Notifications" tab linking to `/settings/notifications`.

- [ ] **Step 3: Run typecheck + commit**

```bash
pnpm turbo run typecheck --filter=@walt/web
git add apps/web/src/app/settings/notifications/
git commit -m "feat: add notification preferences settings page"
```

---

## Task 11: Full Typecheck + Lint + Build

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck + lint**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `pnpm turbo run build --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Fix any errors**

- [ ] **Step 4: Commit any fixes**

```bash
git add <specific-files>
git commit -m "fix: resolve typecheck and lint issues in journey engine UI"
```

---

## Task Summary

| # | Task | Dependencies | Est. Files |
|---|------|-------------|-----------|
| 1 | Install shadcn Components | None | 7 |
| 2 | Backend API Fixes | None | 7 |
| 3 | Navigation + Shared Components | Task 1 | 2 |
| 4 | Notification Bell + Toast Provider | Tasks 1, 2 | 4 |
| 5 | AI Status Toggle for Inbox | Task 1 | 2 |
| 6 | Journey Components | Task 1 | 6 |
| 7 | Journeys List Page | Tasks 3, 6 | 2 |
| 8 | Journey Detail Page | Task 6 | 2 |
| 9 | Upsell Dashboard | Tasks 1, 2, 3 | 4 |
| 10 | Notifications Full Page | Task 4 | 2 |
| 10b | Notification Preferences Page | Task 1 | 2 |
| 11 | Full Typecheck + Lint + Build | All | 0 |

**Parallelizable groups:**
- Tasks 1 and 2 can run in parallel (no shared files)
- Tasks 3, 4, 5, 6 depend on Task 1 but are independent of each other
- Tasks 7 and 8 can run in parallel (detail page is an independent route)
- Tasks 9, 10, and 10b are independent of each other

**Important notes for implementers:**
- This project uses `@base-ui/react` primitives (NOT Radix). Do not use `asChild` prop — use the `render` prop or direct children pattern as seen in existing `Sheet` and `Sidebar` components.
- All UI components displaying guest names from upsell data must handle null gracefully (fallback: "Unknown Guest").
- Use `next/link` for all internal navigation links, not raw `<a>` tags.
