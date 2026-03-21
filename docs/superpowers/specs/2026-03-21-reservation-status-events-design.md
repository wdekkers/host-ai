# Reservation Status Events in Inbox

**Date:** 2026-03-21
**Status:** Draft

## Problem

When a guest cancels a reservation (or a new booking request comes in), there's no visibility in the inbox. The conversation doesn't surface to the top, and there's no indication of the reservation's current status. Airbnb shows these events inline in the thread — we should too.

## Design

### Core Statuses

| Status | Color | Badge Label | System Message |
|--------|-------|-------------|----------------|
| `inquiry` | Blue (`sky-600`) | Inquiry | "Guest sent an inquiry" |
| `pending` | Amber (`amber-500`) | Pending | "New booking request received" |
| `confirmed` | Green (`green-600`) | Confirmed | "Reservation confirmed" |
| `cancelled` | Red (`red-600`) | Cancelled | "Reservation cancelled" |

### Data Model Changes

**Messages table** — add `'system'` as a valid `senderType`. System messages use the existing `messages` table with:
- `senderType: 'system'`
- `body`: Human-readable event description (e.g. "Reservation cancelled")
- `senderFullName: null`
- `reservationId`: Links to the relevant reservation
- `createdAt`: Timestamp of the status change (use Hospitable's `updated_at` when available, fall back to `now()`)
- `raw`: `{ type: "status_change", fromStatus: "<old>", toStatus: "<new>" }` (column is NOT NULL, must provide a value)
- `suggestionScannedAt`: Set to `now()` so the AI suggestion scanner skips system messages

**Unique index safety:** The messages table has a unique index on `(reservationId, createdAt)`. To avoid collisions, use `onConflictDoNothing()` for system message inserts. If a collision occurs, the message is silently skipped (acceptable since re-syncs shouldn't duplicate events).

No schema migration needed — `senderType` is already a free-form text column.

### Sync Logic (sync-hospitable route)

During reservation sync:

1. Before upserting, fetch the current reservation's `status` from DB
2. Compare with incoming `status` from Hospitable
3. If status changed to one of the core set (`inquiry`, `pending`, `confirmed`, `cancelled`):
   - Insert a system message with the appropriate body text and `onConflictDoNothing()`
4. If reservation is new (not in DB) and status is in the core set, also insert a system message
5. Proceed with normal reservation upsert

This naturally bumps the conversation to the top of the inbox since threads are sorted by most recent message timestamp.

**Note:** The sync route currently has business logic in `route.ts`. Per project conventions, the status-change detection logic should be extracted into a sibling `handler.ts` file.

### UI — Status Badge

A small colored badge next to the guest name, shown in:

1. **Conversation list sidebar** (`ConversationList.tsx`) — next to guest name in each thread row
2. **Thread header** (`ConversationThread.tsx`) — next to guest name at top of thread

Use the shadcn `Badge` component (per ui-standards.md) with color overrides:

```tsx
<Badge className="bg-sky-100 text-sky-700 border-0">Inquiry</Badge>
<Badge className="bg-amber-100 text-amber-700 border-0">Pending</Badge>
<Badge className="bg-green-100 text-green-700 border-0">Confirmed</Badge>
<Badge className="bg-red-100 text-red-700 border-0">Cancelled</Badge>
// Fallback:
<Badge variant="secondary">Unknown</Badge>
```

### UI — System Event Cards in Thread

System messages render as centered inline cards, visually distinct from chat bubbles:

- Centered in the thread (not left/right aligned like guest/host messages)
- Muted background, smaller text
- Lucide icon + status text + timestamp
- Icons: `HelpCircle` (inquiry), `Clock` (pending), `CheckCircle` (confirmed), `XCircle` (cancelled)

The `ConversationThread.tsx` message rendering loop checks `senderType === 'system'` and renders a `SystemEventCard` component instead of a regular message bubble.

### API Changes

**`/api/inbox` route:**
- Add `status` field to the thread response (from `reservations.status`)
- **Critical:** The `unreplied` check must look at the latest *non-system* message, not just the latest message. If a guest sends a message and then a status change fires, the conversation must still show as unreplied. Update `latestByReservation` subquery to filter out `senderType = 'system'` when determining unreplied/aiReady status.
- The `lastBody`/`lastMessageAt` sort should still include system messages (so status changes bump to top), but `unreplied` must exclude them.

**`/api/inbox/[reservationId]/messages` route:**
- No changes needed — system messages are regular rows in the messages table and will be returned in chronological order

### Conversation list preview

When the latest message is a system message, `lastBody` will show the event text (e.g. "Reservation cancelled"). This is desirable — it gives immediate context in the list. The `lastSenderType` will be `'system'`, which the UI can use to style the preview differently (e.g. italicized).

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/api/admin/sync-hospitable/route.ts` | Extract to handler.ts, detect status changes, insert system messages |
| `apps/web/src/app/api/admin/sync-hospitable/handler.ts` | New file — sync business logic with status detection |
| `apps/web/src/app/api/inbox/route.ts` | Include `reservations.status` in response, fix unreplied logic to exclude system messages |
| `apps/web/src/app/inbox/InboxClient.tsx` | Update `InboxThread` type to include `status` field |
| `apps/web/src/app/inbox/ConversationList.tsx` | Add status badge next to guest name, style system message previews |
| `apps/web/src/app/inbox/ConversationThread.tsx` | Add status badge in header, render system event cards |

## Out of Scope

- Real-time push notifications (sync is currently manual/cron)
- Email/SMS alerts on status changes
- Custom status types beyond the core four
- Reverse transition handling (e.g. cancelled → confirmed) — will naturally work as another system message, no special handling needed
