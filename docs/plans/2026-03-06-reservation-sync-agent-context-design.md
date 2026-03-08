# Reservation Sync, Agent Context & Question Discovery

**Date:** 2026-03-06
**Status:** Approved

## Problem

- Messages ingested via webhook are stored in an in-memory singleton — lost on restart
- The reply agent has no access to reservation details (guest name, check-in/out, property)
- No visibility into what questions guests commonly ask across reservations

## Goals

1. Persist reservations and messages to Postgres (DB-first, webhook keeps it up to date)
2. Bulk-import existing Hospitable data via a sync endpoint
3. Inject live reservation context into the reply agent's prompt
4. Analyse stored messages with Claude to surface common guest questions
5. Reply agent produces **suggestions only** — no auto-send

---

## Data Model

Two new tables added to `packages/db/src/schema.ts` inside the existing `waltSchema` (`walt` Postgres schema).

### `walt.reservations`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Hospitable UUID — `data[].id` |
| `conversation_id` | text | `data[].conversation_id` |
| `platform` | text | `airbnb`, `vrbo`, etc. |
| `platform_id` | text | Platform-specific booking ref |
| `status` | text | `data[].status` |
| `arrival_date` | timestamptz | `data[].arrival_date` |
| `departure_date` | timestamptz | `data[].departure_date` |
| `check_in` | timestamptz | `data[].check_in` |
| `check_out` | timestamptz | `data[].check_out` |
| `booking_date` | timestamptz | `data[].booking_date` |
| `last_message_at` | timestamptz | `data[].last_message_at` |
| `nights` | integer | `data[].nights` |
| `guest_id` | text | `data[].guest.id` |
| `guest_first_name` | text | `data[].guest.first_name` |
| `guest_last_name` | text | `data[].guest.last_name` |
| `guest_email` | text | `data[].guest.email` |
| `property_id` | text | `data[].properties[0].id` |
| `property_name` | text | `data[].properties[0].name` |
| `raw` | jsonb | Full Hospitable payload for agent context |
| `synced_at` | timestamptz | Set on every upsert |

### `walt.messages`

No `id` in Hospitable's message response — we generate a UUID. Unique constraint on `(reservation_id, created_at)` prevents duplicates on re-sync.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Generated |
| `reservation_id` | text FK → reservations | `data[].reservation_id` |
| `platform` | text | `data[].platform` |
| `body` | text | `data[].body` |
| `sender_type` | text | `host` \| `guest` |
| `sender_full_name` | text | `data[].sender.full_name` |
| `created_at` | timestamptz | `data[].created_at` |
| `suggestion` | text | Nullable — Claude reply draft |
| `suggestion_generated_at` | timestamptz | Nullable |
| `raw` | jsonb | Full Hospitable payload |

---

## Data Flow

### 1. Bulk sync (backfill + on-demand refresh)

`POST /api/admin/sync-hospitable`

1. Fetch `GET /v2/reservations?includes[]=guest&includes[]=properties` — follow `links.next` pagination until exhausted
2. Upsert each reservation into `walt.reservations`
3. For each reservation, fetch `GET /v2/reservations/{id}/messages`
4. Upsert messages into `walt.messages` (on conflict `(reservation_id, created_at)` do update)
5. Return `{ reservations: N, messages: M }` summary

### 2. Webhook (ongoing ingestion)

`POST /api/integrations/hospitable` (existing endpoint)

1. Verify HMAC signature (existing)
2. Parse message payload
3. Fetch reservation from Hospitable live to get full context → upsert into `walt.reservations`
4. Upsert message into `walt.messages`
5. Call Claude with reservation `raw` + message `body` → generate reply suggestion
6. Store suggestion on the message row (`suggestion`, `suggestion_generated_at`)

### 3. Reply agent context

When generating a suggestion, the system prompt includes:
- Guest name, check-in/check-out dates, nights
- Property name and address (from `raw`)
- Platform (Airbnb, Vrbo…)
- Last N messages in the conversation (from `walt.messages` ordered by `created_at`)

Suggestions are stored on the message row — **never auto-sent**.

### 4. Question analysis

`POST /api/admin/analyze-questions`

1. Load all inbound messages (`sender_type = 'guest'`) from `walt.messages`
2. Send to Claude with prompt: extract and categorise common question types, count frequency, draft suggested answers
3. Return structured JSON: `{ categories: [{ name, count, examples[], suggestedAnswer }] }`
4. Display in dashboard — no separate DB table needed for now

---

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/sync-hospitable` | Bulk import all reservations + messages |
| POST | `/api/admin/analyze-questions` | Run question analysis over stored messages |

Both admin routes require `admin` role (existing permission system).

---

## Dashboard Changes

- **Inbox page** — reads from `walt.messages` + `walt.reservations` (DB join) instead of Hospitable live
- **Reservations page** — reads from `walt.reservations`
- **New: Questions page** `/questions` — calls `analyze-questions`, shows question categories, frequency, and suggested answers

---

## Out of Scope (this iteration)

- Auto-sending replies
- Per-property knowledge base
- Embedding / vector search
- Real-time push to inbox (polling or manual refresh is fine)
