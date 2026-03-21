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
- `createdAt`: Timestamp of the status change

No schema migration needed — `senderType` is already a free-form text column.

### Sync Logic (sync-hospitable route)

During reservation sync:

1. Before upserting, fetch the current reservation's `status` from DB
2. Compare with incoming `status` from Hospitable
3. If status changed to one of the core set (`inquiry`, `pending`, `confirmed`, `cancelled`):
   - Insert a system message with the appropriate body text
   - Timestamp = `now()`
4. If reservation is new (not in DB) and status is in the core set, also insert a system message
5. Proceed with normal reservation upsert

This naturally bumps the conversation to the top of the inbox since threads are sorted by most recent message timestamp.

### UI — Status Badge

A small colored pill badge next to the guest name, shown in:

1. **Conversation list sidebar** (`ConversationList.tsx`) — next to guest name in each thread row
2. **Thread header** (`ConversationThread.tsx`) — next to guest name at top of thread

Badge rendering:
```
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-{color}-100 text-{color}-700">
  {label}
</span>
```

Color mapping uses Tailwind classes:
- Inquiry: `bg-sky-100 text-sky-700`
- Pending: `bg-amber-100 text-amber-700`
- Confirmed: `bg-green-100 text-green-700`
- Cancelled: `bg-red-100 text-red-700`
- Fallback (unknown status): `bg-gray-100 text-gray-700`

### UI — System Event Cards in Thread

System messages render as centered inline cards, visually distinct from chat bubbles:

- Centered in the thread (not left/right aligned like guest/host messages)
- Muted background, smaller text
- Icon + status text + timestamp
- Example: `[ 🔴 Reservation cancelled · Mar 21, 2026 ]`

The `ConversationThread.tsx` message rendering loop checks `senderType === 'system'` and renders a `SystemEventCard` component instead of a regular message bubble.

### API Changes

**`/api/inbox` route:**
- Add `status` field to the thread response (from `reservations.status`)
- System messages should NOT count as "unreplied" — only `senderType === 'guest'` triggers unreplied status (already works this way since the check is `senderType === 'guest'`)

**`/api/inbox/[reservationId]/messages` route:**
- No changes needed — system messages are regular rows in the messages table and will be returned in chronological order

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/api/admin/sync-hospitable/route.ts` | Detect status changes, insert system messages |
| `apps/web/src/app/api/inbox/route.ts` | Include `reservations.status` in thread response |
| `apps/web/src/app/inbox/ConversationList.tsx` | Add status badge next to guest name |
| `apps/web/src/app/inbox/ConversationThread.tsx` | Add status badge in header, render system event cards |

## Out of Scope

- Real-time push notifications (sync is currently manual/cron)
- Email/SMS alerts on status changes
- Custom status types beyond the core four
