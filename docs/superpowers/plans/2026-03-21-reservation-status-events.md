# Reservation Status Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show reservation status changes (cancelled, confirmed, pending, inquiry) as inline event cards in conversation threads, with color-coded badges next to guest names.

**Architecture:** System messages inserted during Hospitable sync when reservation status changes. These use the existing `messages` table with `senderType: 'system'`. The inbox sorts by latest message, so system messages naturally bump conversations to the top. Status badges use the shadcn `Badge` component with color overrides.

**Tech Stack:** Next.js, Drizzle ORM, PostgreSQL, Tailwind CSS, shadcn/ui, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-21-reservation-status-events-design.md`

---

### Task 1: Extract sync business logic to handler.ts

Per project conventions, `route.ts` should only export HTTP method handlers. Extract sync logic into a sibling `handler.ts`.

**Files:**
- Create: `apps/web/src/app/api/admin/sync-hospitable/handler.ts`
- Modify: `apps/web/src/app/api/admin/sync-hospitable/route.ts`

- [ ] **Step 1: Create handler.ts with extracted logic**

Move all imports, functions, and types from `route.ts` into `handler.ts`:
- All imports: `v4 as uuidv4` from `uuid`, `properties`/`reservations`/`messages` from `@walt/db`, `db` from `@/lib/db`, `getHospitableApiConfig` from `@/lib/integrations-env`, normalize functions from `@/lib/hospitable-normalize`
- `HospitableListResponse` type
- `headers()` function
- `fetchAllProperties()` function
- `ReservationFetchResult` type
- `fetchReservationsForProperty()` function
- `fetchMessagesForReservation()` function
- `extractGuestFromMessages()` function
- `syncHospitable()` — new function wrapping the body of `POST()` (lines 114-198 of current `route.ts`), returning the JSON payload directly

Export `syncHospitable` as a named export.

- [ ] **Step 2: Simplify route.ts to only export POST**

```ts
import { NextResponse } from 'next/server';
import { syncHospitable } from './handler';

export async function POST() {
  return NextResponse.json(await syncHospitable());
}
```

- [ ] **Step 3: Verify sync still works**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/admin/sync-hospitable/handler.ts apps/web/src/app/api/admin/sync-hospitable/route.ts
git commit -m "refactor: extract sync-hospitable business logic to handler.ts"
```

---

### Task 2: Insert system messages on status changes during sync

Detect when a reservation's status changes and insert a system message into the `messages` table.

**Files:**
- Modify: `apps/web/src/app/api/admin/sync-hospitable/handler.ts`

**Reference:**
- Messages table schema: `packages/db/src/schema.ts:196-219`
- Reservations table schema: `packages/db/src/schema.ts:77-98`
- Unique index on messages: `(reservationId, createdAt)` — use `onConflictDoNothing()`

- [ ] **Step 1: Add status change detection and system message insertion**

In `handler.ts`, add `eq` to the drizzle-orm import (which was already brought over in Task 1):

```ts
import { eq } from 'drizzle-orm';
```

Add these constants at the top of `handler.ts` (outside any function):

```ts
const CORE_STATUSES = ['inquiry', 'pending', 'confirmed', 'cancelled'] as const;

const STATUS_MESSAGES: Record<string, string> = {
  inquiry: 'Guest sent an inquiry',
  pending: 'New booking request received',
  confirmed: 'Reservation confirmed',
  cancelled: 'Reservation cancelled',
};
```

Inside the reservation loop, add status detection **before** the reservation upsert, and system message insertion **after** it (to avoid FK violation on new reservations):

```ts
// --- BEFORE the reservation upsert: fetch old status ---
const newStatus = normalized.status;
let oldStatus: string | null = null;

const [existing] = await db
  .select({ status: reservations.status })
  .from(reservations)
  .where(eq(reservations.id, normalized.id))
  .limit(1);

if (existing) {
  oldStatus = existing.status;
}

// --- Existing reservation upsert stays here ---
await db
  .insert(reservations)
  .values({ ...normalized, syncedAt: now })
  .onConflictDoUpdate({ ... });

// --- AFTER the reservation upsert: insert system message if status changed ---
if (
  newStatus &&
  CORE_STATUSES.includes(newStatus as (typeof CORE_STATUSES)[number]) &&
  newStatus !== oldStatus
) {
  // Use Hospitable's updated_at timestamp when available, fall back to now()
  const statusChangedAt = raw.updated_at
    ? new Date(String(raw.updated_at))
    : new Date();

  await db
    .insert(messages)
    .values({
      id: uuidv4(),
      reservationId: normalized.id,
      platform: normalized.platform ?? null,
      body: STATUS_MESSAGES[newStatus] ?? `Reservation status: ${newStatus}`,
      senderType: 'system',
      senderFullName: null,
      createdAt: statusChangedAt,
      raw: { type: 'status_change', fromStatus: oldStatus, toStatus: newStatus },
      suggestionScannedAt: new Date(), // skip AI suggestion scanner
    })
    .onConflictDoNothing();
}

// --- Existing message sync loop continues after ---
```

**Key points:**
- Status comparison happens BEFORE the upsert (so we can see the old status)
- System message insert happens AFTER the upsert (so the reservation FK exists)
- Uses `raw.updated_at` from Hospitable payload for accurate chronological placement
- `onConflictDoNothing()` prevents duplicates on re-sync
- `uuidv4` is already available from the Task 1 extraction

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/sync-hospitable/handler.ts
git commit -m "feat: insert system messages on reservation status changes"
```

---

### Task 3: Add reservation status to inbox API response

Include `status` in the thread list so the UI can render badges.

**Files:**
- Modify: `apps/web/src/app/api/inbox/route.ts:45-62` (reservationRows select)
- Modify: `apps/web/src/app/inbox/InboxClient.tsx:7-22` (InboxThread type)

- [ ] **Step 1: Add status to reservation select in inbox API**

In `apps/web/src/app/api/inbox/route.ts`, add `status` to the `reservationRows` select (around line 47):

```ts
// Add to the select object:
status: reservations.status,
```

And add `status` to the thread response object (around line 108):

```ts
// Add to the return object inside threads.map:
status: res?.status ?? null,
```

- [ ] **Step 2: Update InboxThread type**

In `apps/web/src/app/inbox/InboxClient.tsx`, add `status` to the `InboxThread` type:

```ts
export type InboxThread = {
  reservationId: string;
  guestName: string;
  propertyId: string | null;
  propertyName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
  lastBody: string;
  lastSenderType: string;
  lastMessageAt: string;
  unreplied: boolean;
  aiReady: boolean;
  latestMessageId: string | null;
  latestSuggestion: string | null;
  status: string | null;
};
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/inbox/route.ts apps/web/src/app/inbox/InboxClient.tsx
git commit -m "feat: include reservation status in inbox thread response"
```

---

### Task 4: Fix unreplied logic to exclude system messages

System messages must not mask the unreplied state. If a guest message is the latest non-system message, the thread should still show as unreplied.

**Files:**
- Modify: `apps/web/src/app/api/inbox/route.ts:67-95` (mostRecentMessages query and latestByReservation logic)

- [ ] **Step 1: Filter system messages from unreplied detection**

In `apps/web/src/app/api/inbox/route.ts`, update the `latestByReservation` loop (around lines 87-95) to skip system messages when determining unreplied/aiReady:

```ts
const latestByReservation = new Map<
  string,
  { senderType: string; suggestion: string | null; id: string }
>();
for (const m of mostRecentMessages) {
  // Skip system messages for unreplied/aiReady detection
  if (m.senderType === 'system') continue;
  if (!latestByReservation.has(m.reservationId)) {
    latestByReservation.set(m.reservationId, {
      senderType: m.senderType,
      suggestion: m.suggestion,
      id: m.id,
    });
  }
}
```

This ensures that if a guest sends a message and then a status change fires, the thread still shows as "unreplied".

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/inbox/route.ts
git commit -m "fix: exclude system messages from unreplied detection"
```

---

### Task 5: Extract shared status config and add badge to conversation list

Extract status badge/icon config to a shared file (used by both ConversationList and ConversationThread), then add the badge to the sidebar.

**Files:**
- Create: `apps/web/src/app/inbox/status-config.ts`
- Modify: `apps/web/src/app/inbox/ConversationList.tsx:125-135` (guest name area in thread row)

- [ ] **Step 1: Create shared status config**

Create `apps/web/src/app/inbox/status-config.ts`:

```ts
import { HelpCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

export const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  inquiry: { label: 'Inquiry', className: 'bg-sky-100 text-sky-700 border-0' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-0' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700 border-0' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-0' },
};

export const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inquiry: HelpCircle,
  pending: Clock,
  confirmed: CheckCircle,
  cancelled: XCircle,
};

export const STATUS_COLORS: Record<string, string> = {
  inquiry: 'text-sky-600',
  pending: 'text-amber-500',
  confirmed: 'text-green-600',
  cancelled: 'text-red-600',
};
```

- [ ] **Step 2: Add StatusBadge to ConversationList**

At the top of `ConversationList.tsx`, add the imports:

```tsx
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE_CONFIG } from './status-config';
```

In the thread row, after the guest name `<span>` (around line 131), add the badge:

```tsx
<div className="flex items-center gap-1.5">
  <span
    className={`text-xs font-semibold ${t.unreplied ? 'text-slate-900' : 'text-slate-700'}`}
  >
    {t.guestName}
  </span>
  {t.status && STATUS_BADGE_CONFIG[t.status] && (
    <Badge className={`text-[9px] h-4 ${STATUS_BADGE_CONFIG[t.status].className}`}>
      {STATUS_BADGE_CONFIG[t.status].label}
    </Badge>
  )}
  {t.unreplied && (
    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-sky-600" />
  )}
</div>
```

- [ ] **Step 2: Style system message previews in the list**

When `lastSenderType` is `'system'`, italicize the preview text. Update the `lastBody` line (around line 140):

```tsx
<p className={`text-xs truncate mb-1.5 text-slate-500 ${t.lastSenderType === 'system' ? 'italic' : ''}`}>
  {t.lastBody}
</p>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/inbox/status-config.ts apps/web/src/app/inbox/ConversationList.tsx
git commit -m "feat: add color-coded status badge to conversation list"
```

---

### Task 6: Add status badge and system event cards to conversation thread

Show the status badge in the thread header and render system messages as centered event cards.

**Files:**
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx:7-24` (types)
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx:139-160` (header)
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx:173-216` (message rendering)
- Modify: `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts:31-44` (add status to reservation select)

- [ ] **Step 1: Add status to messages API response**

In `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts`, add `status` to the reservation select (around line 33):

```ts
status: reservations.status,
```

And include it in the response object (around line 52):

```ts
const reservation = reservationRow
  ? {
      guestFirstName: reservationRow.guestFirstName,
      guestLastName: reservationRow.guestLastName,
      propertyName: reservationRow.propertyName,
      propertyId: reservationRow.propertyId,
      checkIn: reservationRow.checkIn?.toISOString() ?? null,
      checkOut: reservationRow.checkOut?.toISOString() ?? null,
      platform: reservationRow.platform,
      status: reservationRow.status,
    }
  : null;
```

- [ ] **Step 2: Update types in ConversationThread.tsx**

Add `status` to the `ReservationInfo` type and `raw` to the `Message` type (around lines 7-24):

```ts
type Message = {
  id: string;
  reservationId: string;
  body: string;
  senderType: string;
  senderFullName: string | null;
  createdAt: string;
  raw: unknown;
};

type ReservationInfo = {
  guestFirstName: string | null;
  guestLastName: string | null;
  propertyName: string | null;
  propertyId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  platform: string | null;
  status: string | null;
};
```

- [ ] **Step 3: Add imports from shared config**

At the top of `ConversationThread.tsx`, add:

```tsx
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE_CONFIG, STATUS_ICONS, STATUS_COLORS } from './status-config';
```

- [ ] **Step 4: Add status badge to thread header**

In the header (around line 150), after the guest name `<p>` tag, add the badge:

```tsx
<div className="min-w-0 flex-1">
  <div className="flex items-center gap-2">
    <p className="text-sm font-bold text-slate-900">{guestName}</p>
    {reservation?.status && STATUS_BADGE_CONFIG[reservation.status] && (
      <Badge className={STATUS_BADGE_CONFIG[reservation.status].className}>
        {STATUS_BADGE_CONFIG[reservation.status].label}
      </Badge>
    )}
  </div>
  <p className="text-xs truncate text-slate-500">
    {reservation?.propertyName ?? '—'}
    {reservation?.checkIn &&
      ` · ${new Date(reservation.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
    {reservation?.checkOut &&
      ` – ${new Date(reservation.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
    {reservation?.platform && ` · ${reservation.platform}`}
  </p>
</div>
```

- [ ] **Step 5: Add system event card rendering in message loop**

In the message rendering loop (around line 173), add a check for system messages before the regular message rendering. Use the `raw` field's `toStatus` to determine the icon/color (more robust than body text matching):

```tsx
{messages.map((m) => {
  // System event card
  if (m.senderType === 'system') {
    const rawData = m.raw as { toStatus?: string } | null;
    const statusKey = rawData?.toStatus ?? undefined;
    const Icon = statusKey ? STATUS_ICONS[statusKey] : null;
    const color = statusKey ? STATUS_COLORS[statusKey] : 'text-slate-500';

    return (
      <div key={m.id} className="flex justify-center my-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
          {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
          <span className={`text-xs font-medium ${color}`}>{m.body}</span>
          <span className="text-xs text-slate-400">
            · {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    );
  }

  // Regular message bubble (existing code)
  const isHost = m.senderType === 'host';
  // ... rest of existing code
```

- [ ] **Step 6: Fix thread-level unreplied logic to skip system messages**

Update the `latestIsGuest` / `unrepliedMessage` logic in `ConversationThread.tsx` (around lines 131-134) to exclude system messages, consistent with the inbox API fix in Task 4:

```tsx
const latestNonSystem = [...messages].reverse().find((m) => m.senderType !== 'system');
const latestIsGuest = latestNonSystem?.senderType === 'guest';
const unrepliedMessage = latestIsGuest ? (latestNonSystem ?? null) : null;
const latestGuestMessage = [...messages].reverse().find((m) => m.senderType === 'guest') ?? null;
```

This ensures the "needs reply" tag and AiDraftPanel still appear even if a system message was inserted after the guest's message.

- [ ] **Step 7: Verify typecheck and lint pass**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/inbox/ConversationThread.tsx apps/web/src/app/api/inbox/[reservationId]/messages/route.ts
git commit -m "feat: status badge in thread header and system event cards"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full check**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: All pass

- [ ] **Step 2: Commit any remaining fixes if needed**
