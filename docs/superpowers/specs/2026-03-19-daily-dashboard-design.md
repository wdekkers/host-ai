# Daily Operations Dashboard — Design Spec

**Date:** 2026-03-19
**Status:** Ready for review

## Overview

A daily operations dashboard (`/today`) that surfaces what needs to happen for each property that day — turnovers, tasks due, and AI-generated suggestions drawn from guest messages and upcoming reservations. Reminders can be delivered via SMS and email. Pool monitoring (iAqualink + Poolside Tech integration) is a separate future phase.

## Scope

### In scope (Phase 1)

- `/today` as the default landing page (root `/` redirects there)
- Daily summary: turnovers, urgent tasks, tasks due today
- AI task suggestions: message-triggered and reservation-triggered
- Accept/dismiss suggestions flow
- Reminder scheduling: SMS (Twilio) + email (Resend)
- 7am daily cron for proactive reservation-based suggestions
- 30-minute message-scanning cron for message-triggered suggestions
- 15-minute cron for reminder delivery

### Out of scope (future phases)

- Pool temperature monitoring (iAqualink, Poolside Tech) — Phase 2
- Push notifications / native app — not planned
- Multi-user reminder routing — reminders go to org owner only for now

## Data Model

### Existing table: `properties` (addition)

Add one column to support pool-specific suggestions:

| Column | Type | Notes |
|---|---|---|
| `has_pool` | boolean | DEFAULT false — manually set per property via settings UI |

**Note:** The `properties` table has no `organization_id` column. Org scoping for properties is always resolved by joining through `property_access`: `WHERE id IN (SELECT property_id FROM walt.property_access WHERE organization_id = $orgId)`.

### Existing table: `messages` (addition)

Add one column to support efficient message-scanning deduplication. This column does not currently exist in the schema — a Drizzle migration must be generated after updating the `messages` table definition in `packages/db/src/schema.ts` (update the existing definition, do not add a new one).

| Column | Type | Notes |
|---|---|---|
| `suggestion_scanned_at` | timestamptz | nullable — set after the message-scanning cron evaluates this message |

The cron queries `messages WHERE suggestion_scanned_at IS NULL AND created_at > now() - interval '2 hours'` (2-hour window provides overlap safety for the 30-minute cron). After evaluating a message (whether or not a suggestion is generated), set `suggestion_scanned_at = now()`.

### New table: `task_suggestions`

Stores AI-generated suggestions before the user accepts or dismisses them.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | text NOT NULL | |
| `property_id` | text NOT NULL | |
| `reservation_id` | text NOT NULL | always set — message-triggered suggestions are always in the context of a reservation. Soft reference (no DB FK) — reservations are synced from Hospitable and may be re-synced. |
| `message_id` | uuid | nullable — set when triggered by a message. Soft reference (no DB FK) — same reason. |
| `title` | text NOT NULL | suggested task title |
| `description` | text | nullable |
| `suggested_due_date` | timestamptz | nullable for message-triggered; always populated for reservation-triggered |
| `source` | text NOT NULL | `message` or `reservation` |
| `status` | text NOT NULL | `pending`, `accepted`, `dismissed` — default `pending` |
| `created_at` | timestamptz NOT NULL | |

**Unique constraint:** `UNIQUE (organization_id, reservation_id, title)` — prevents duplicate suggestions per reservation + action. `reservation_id` is NOT NULL so the constraint is always scoped.

**Indexes:**
- `(organization_id, status)` — dashboard query pattern

### New table: `task_reminders`

Tracks scheduled reminders for accepted tasks.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | text NOT NULL | soft reference to gateway task ID — no DB FK (tasks are gateway-owned) |
| `organization_id` | text NOT NULL | |
| `channels` | text[] NOT NULL | e.g. `['sms', 'email']` |
| `scheduled_for` | timestamptz NOT NULL | when to send |
| `sent_at` | timestamptz | nullable — set after delivery |
| `created_at` | timestamptz NOT NULL | |

**Indexes:**
- Partial index on `(scheduled_for) WHERE sent_at IS NULL` — cron delivery query

### Tasks: no local schema changes

Tasks are owned by the gateway service. `source` (`'manual'` or `'ai'`) and `sourceReservationId` are passed as additional fields in the `POST /api/tasks` request body. The gateway is expected to store and echo them. No local DB migration needed for tasks.

## API Endpoints

All new endpoints use the existing `withPermission` auth pattern (Clerk session). Because `POST /api/task-suggestions/[id]/accept` is always user-initiated (called from the browser), it receives and can forward the user's Authorization header to the gateway — no service token is needed.

Cron route handlers are protected separately (see Cron Security section).

### `GET /api/task-suggestions`

Query params: `status=pending` (default)

Returns all `task_suggestions` for the authenticated org with the given status, ordered by `created_at DESC`.

Response: `{ suggestions: TaskSuggestion[] }`

### `POST /api/task-suggestions/[id]/accept`

Body: `{ reminderChannels?: ('sms' | 'email')[], reminderTime?: string (ISO) }`

1. Creates task via gateway (`POST GATEWAY_BASE_URL/tasks`) with `source: 'ai'` and `sourceReservationId` in the body, forwarding the user's Authorization header
2. If `reminderChannels` provided: inserts row into `task_reminders`
3. Marks suggestion `status = 'accepted'`

**Response on full success:** `200 { task, reminder }`

**Response when task fails:** `502` — suggestion is NOT marked accepted, reminder is NOT created

**Response when task succeeds but reminder fails:** `200 { task, reminder: null, reminderWarning: "Reminder could not be saved" }` — suggestion IS marked accepted. Using 200 with a warning field rather than 207 (which has WebDAV semantics).

### `POST /api/task-suggestions/[id]/dismiss`

No body. Marks suggestion `status = 'dismissed'`.

Response: `200 { ok: true }`

### `POST /api/task-reminders` _(Phase 2 — not shipped in Phase 1)_

Body: `{ taskId: string, channels: string[], scheduledFor: string (ISO) }`

Creates a reminder for an existing manually-created task. Deferred to Phase 2 when the `/tasks` view gets reminder UI. Not implemented in Phase 1.

Response: `200 { reminder: TaskReminder }`

## Pages & Components

### `/today` — Daily Dashboard

Server-rendered page. Root `/` redirects here (replacing existing redirect to `/reservations` in `apps/web/src/app/page.tsx`).

**Layout (mobile-first, top to bottom):**

1. **Header** — "Today · {Day} {Date}"
2. **Suggestions stack** (client component) — fetches pending suggestions client-side via `GET /api/task-suggestions`. Renders stacked cards, one per suggestion. Each card: property name, suggested action, source context line (e.g. "Guest mentioned pool & hot tub"). Actions:
   - **Add task** → inline expand: title (pre-filled, editable), due date/time picker, reminder checkboxes (SMS / Email) → confirm → `POST /api/task-suggestions/[id]/accept` → card animates out
   - **Skip** → `POST /api/task-suggestions/[id]/dismiss` → card animates out immediately, no confirmation
3. **Summary row** — three chips: Turnovers · Urgent · Tasks Due. Tap to anchor-scroll to section
4. **Turnovers section** — reservations where `departure_date::date = today OR arrival_date::date = today`, scoped to org via `property_access` join (the `reservations` table has no `organization_id`). Query pattern:
   ```sql
   SELECT r.* FROM reservations r
   JOIN property_access pa ON pa.property_id = r.property_id
   WHERE pa.organization_id = $orgId
     AND (r.arrival_date::date = today OR r.departure_date::date = today)
   ORDER BY COALESCE(r.departure_date, r.arrival_date)
   ```
   Shows property name, guest name, checkout/checkin times.
5. **Tasks due today section** — two fetches from the gateway API:
   - Tasks with `dueDate = today` (query param: `due_date=today`)
   - Open tasks with `priority = urgent` (query param: `priority=urgent&status=open`)
   Results merged and grouped by property. Urgent tasks surface permanently until resolved — intentional, so nothing slips.

**Data fetching:**
- Server: turnovers from local `reservations` table
- Server: tasks (both queries) from gateway via internal fetch with a service header (see Cron Security — same `CRON_SECRET` used for server→gateway internal calls). **Pre-implementation requirement:** confirm the gateway accepts `Authorization: Bearer <CRON_SECRET>` on task endpoints. Current gateway calls all forward the user's Clerk JWT; this introduces a new server-to-gateway auth pattern. If the gateway does not support it, use the Clerk `getToken()` server-side helper to mint a short-lived token instead.
- Client: pending suggestions via `GET /api/task-suggestions`
- On `visibilitychange` to `visible`: call `router.refresh()` (re-runs server component) + re-fetch suggestions. Covers coming back to the tab on mobile.

### Existing `/tasks` page

Unchanged.

## AI Suggestion Generation

### Trigger 1: Message-scanning cron (every 30 minutes — Vercel Cron Job)

Queries: `messages WHERE suggestion_scanned_at IS NULL AND created_at > now() - interval '2 hours' AND sender_type = 'guest'`

For each message:
1. Fetch reservation context (`reservation_id`, property name, `arrival_date`)
2. Run AI classification: input is message body + context; output is zero or one suggested task
3. Actionable signals: pool/spa requests, early check-in, late check-out, extra supplies, special occasions
4. If suggestion produced: insert into `task_suggestions` (skip on unique constraint violation)
5. Set `messages.suggestion_scanned_at = now()` regardless of whether a suggestion was generated

### Trigger 2: Daily 7am cron (Vercel Cron Job)

Runs at 07:00 UTC. Phase 1 does not adjust for org timezone — this is a known limitation.

Queries reservations where `arrival_date::date = today OR arrival_date::date = tomorrow`.

For each reservation, resolve the property by joining through `property_access` (`WHERE organization_id = $orgId`).

Standard suggestions:
- **All properties**: "Send welcome message to [guest first name]" — due: arrival day 09:00 UTC
- **Properties where `has_pool = true`**: "Start pool heating before [guest first name] arrival" — due: day before arrival 10:00 UTC

Insert with `source = 'reservation'`. Duplicate rows (same `organization_id, reservation_id, title`) silently skipped via `INSERT ... ON CONFLICT DO NOTHING`.

## Org Owner Contact Resolution

At reminder send time:
1. Query `organization_memberships WHERE organization_id = $orgId AND role = 'owner'` → get `user_id`
2. Call Clerk Backend API `GET /v1/users/{userId}` using `CLERK_SECRET_KEY`
3. Use `primary_email_address_id` to find email; use first entry in `phone_numbers` for SMS
4. If no phone number found: skip SMS, log warning, continue with email only

Contact details are never cached locally — always fetched from Clerk at send time.

## Reminder Delivery Cron (every 15 minutes — Vercel Cron Job)

Query: `task_reminders WHERE scheduled_for <= now() AND sent_at IS NULL`

For each reminder:
1. Fetch org owner contact via Clerk
2. Send via each configured channel:
   - **SMS** (Twilio): `[Walt] Reminder: {task title} — {property name}`
   - **Email** (Resend):
     - Subject: `Reminder: {task title}`
     - Body: `Hi, this is a reminder for your task at {property name}.\n\nTask: {task title}\nDue: {due date/time}\n\nView your dashboard: https://app.walt.ai/today`
3. Set `sent_at = now()` after all sends complete
4. On failure: log error, leave `sent_at = null` — retry on next run (15-minute cadence)

## Cron Security

All cron route handlers (e.g. `POST /api/cron/scan-messages`, `POST /api/cron/daily-suggestions`, `POST /api/cron/send-reminders`) verify:

```typescript
if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

`vercel.json` configures the schedule and Vercel injects this header automatically. `CRON_SECRET` is also used for internal server→gateway calls (server-side task fetches on `/today`) so the gateway can verify the caller is trusted.

## Navigation

- "Today" added as the first item in the sidebar nav (before "Inbox")
- Root `/` redirects to `/today` — replaces existing redirect to `/reservations` in `apps/web/src/app/page.tsx`

## New Dependencies

- **Resend** (`resend` npm package) — transactional email. Add `RESEND_API_KEY` to env.
- **Vercel Cron Jobs** — defined in `vercel.json`. No additional package needed.
- New env vars: `RESEND_API_KEY`, `CRON_SECRET`

## Testing

- Unit: AI classification — input message bodies with pool/early-checkin/supply signals → assert correct suggestion titles and due dates; input generic message → assert no suggestion
- Unit: message-scanning cron — messages with `suggestion_scanned_at` already set are skipped; `suggestion_scanned_at` is set on every evaluated message whether or not a suggestion was generated
- Unit: daily cron — only reservations arriving today/tomorrow are processed; `has_pool = false` properties don't get pool heating suggestion; duplicate reservations produce no duplicate rows
- Unit: cron org scoping — suggestions are only generated for reservations whose property belongs to the org (via `property_access` join)
- Unit: reminder delivery — mock Twilio + Resend + Clerk; assert `sent_at` set on success; assert `sent_at` left null on failure; assert SMS skipped gracefully when no Clerk phone number
- Unit: accept flow — task creation fails (gateway 502) → suggestion not marked accepted, 502 returned; task succeeds + reminder DB insert fails → 200 with `reminderWarning`, suggestion marked accepted
- Integration: full accept flow — suggestion → task created (mocked gateway) → reminder row inserted → `GET /api/task-suggestions` returns `status: accepted`
