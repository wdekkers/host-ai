# Daily Operations Dashboard — Design Spec

**Date:** 2026-03-19
**Status:** Approved

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
- 15-minute cron for reminder delivery

### Out of scope (future phases)

- Pool temperature monitoring (iAqualink, Poolside Tech) — Phase 2
- Push notifications / native app — not planned
- Multi-user reminder routing — reminders go to org owner only for now

## Data Model

### New table: `task_suggestions`

Stores AI-generated suggestions before the user accepts or dismisses them.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | text | |
| `property_id` | text | |
| `reservation_id` | text | nullable |
| `message_id` | uuid | nullable — set when triggered by a message |
| `title` | text | suggested task title |
| `description` | text | nullable |
| `suggested_due_date` | timestamptz | nullable |
| `source` | text | `message` or `reservation` |
| `status` | text | `pending`, `accepted`, `dismissed` |
| `created_at` | timestamptz | |

Unique constraint: `(organization_id, reservation_id, title)` — prevents duplicate suggestions for the same reservation + action.

### New table: `task_reminders`

Tracks scheduled reminders for accepted tasks.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid FK → tasks | |
| `organization_id` | text | |
| `channels` | text[] | e.g. `['sms', 'email']` |
| `scheduled_for` | timestamptz | when to send |
| `sent_at` | timestamptz | nullable — set after delivery |
| `created_at` | timestamptz | |

### Existing table: `tasks` (additions)

Two new columns:

| Column | Type | Notes |
|---|---|---|
| `source` | text | `manual` or `ai` — default `manual` |
| `source_reservation_id` | text | nullable — links task back to reservation |

## Pages & Components

### `/today` — Daily Dashboard

Server-rendered page. Root `/` redirects here.

**Layout (mobile-first, top to bottom):**

1. **Header** — "Today · {Day} {Date}"
2. **Suggestions stack** (client component) — stacked cards for each `pending` suggestion. Each card shows property name, suggested action, and source context (e.g. "Guest mentioned pool use"). Actions: **Add task** (opens reminder picker, then creates task) / **Skip** (dismisses)
3. **Summary row** — three tappable chips: Turnovers · Urgent · Tasks Due. Tap to jump to section
4. **Turnovers section** — properties with checkout or checkin today, showing times and guest names
5. **Tasks due today section** — open tasks where `due_date = today` or `priority = urgent`, grouped by property

**Data fetching:**
- Server: turnovers (from `reservations` where `arrival_date = today OR departure_date = today`), tasks due today
- Client: pending suggestions via `GET /api/task-suggestions`
- Page refreshes data on window focus (via `visibilitychange` event)

### Existing `/tasks` page

Unchanged — remains the full task management view for creating, editing, and reviewing all tasks.

## AI Suggestion Generation

### Trigger 1: Incoming message

After a guest message is received (in the existing message handling path), run an AI classification step:

- Input: message body + reservation context (property name, checkin date)
- Output: zero or one suggested task (title, description, suggested due date)
- Actionable signals to detect: pool/spa requests, early check-in, late check-out, extra supplies, special occasions
- Insert into `task_suggestions` with `source = 'message'`, `status = 'pending'`
- Skip if a suggestion with the same `(organization_id, reservation_id, title)` already exists

### Trigger 2: Daily 7am cron

Scans reservations arriving within the next 48 hours. For each, generates standard suggestions based on property attributes:

- **All properties**: "Send welcome message to [guest name]" (due: checkin day, morning)
- **Properties with pool**: "Start pool heating before [guest name] arrival" (due: day before checkin, 10am)

Insert with `source = 'reservation'`, deduplicated by `(organization_id, reservation_id, title)`.

## Accept / Dismiss Flow

**Accept:**
1. User taps "Add task" on a suggestion card
2. A simple inline form appears: task title (pre-filled), due date/time, reminder channels (SMS ☐ Email ☐)
3. On confirm: create task via `POST /api/tasks`, optionally create reminder via `POST /api/task-reminders`, mark suggestion `accepted`
4. Card animates out of the suggestions stack

**Dismiss:**
1. User taps "Skip"
2. Suggestion marked `dismissed` immediately
3. Card animates out — no confirmation needed

## Reminder Delivery

### Channels

- **SMS** — Twilio, sends to org owner's registered phone number
- **Email** — Resend, sends to org owner's email address

### Delivery cron (every 15 minutes)

Query: `task_reminders WHERE scheduled_for <= now() AND sent_at IS NULL`

For each:
1. Load task + org owner contact details
2. Send via each configured channel
3. Set `sent_at = now()`
4. On failure: log error, do not set `sent_at` (will retry on next cron run)

### Message format

SMS: `[Walt] Reminder: {task title} — {property name}`
Email: Subject `Reminder: {task title}`, body includes property, due time, and a link to `/today`

## Navigation

- `/today` added to sidebar as the first item (replacing whatever is currently first)
- Root `/` redirects to `/today`
- Sidebar label: "Today"

## Testing

- Unit tests for AI suggestion classification (input message → expected suggestion output)
- Unit tests for cron deduplication logic (same reservation + title → no duplicate)
- Unit tests for reminder delivery handler (mock SMS/email, verify `sent_at` set)
- Integration test: full accept flow (suggestion → task created → reminder created)
