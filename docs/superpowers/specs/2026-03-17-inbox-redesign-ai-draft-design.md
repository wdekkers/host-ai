# Inbox Redesign + AI Draft + Guidebook + Agent Config

**Date:** 2026-03-17
**Status:** Draft

---

## 1. Overview

Replace the current single-column inbox with a two-column layout (30/70 split). The right column shows the full conversation thread and an AI draft panel that auto-generates a reply whenever a new guest message arrives. The AI draws from a per-property knowledge stack: FAQ (existing), Digital Guidebook (new), and Learned Memory (auto-populated). Agent behavior is configured globally with per-property overrides.

---

## 2. Architecture

### 2.1 Knowledge Stack (per property)

| Layer              | What it contains                       | Where it lives                 |
| ------------------ | -------------------------------------- | ------------------------------ |
| **FAQ**            | Guest Q&A (existing)                   | `walt.property_faqs`           |
| **Guidebook**      | How-tos, instructions, video links     | `walt.guidebook_entries` (new) |
| **Learned Memory** | Facts extracted from feedback sessions | `walt.property_memory` (new)   |
| **Agent Behavior** | Tone, emoji, escalation rules          | `walt.agent_configs` (new)     |

When drafting a reply, the AI queries all four layers for the relevant property.

### 2.2 Agent Config Stack

- **Global Agent Config** — default tone, emoji use, response length, escalation rules. Applies to all properties.
- **Per-Property Agent Config** — overrides specific fields from global. Only set what differs. Includes a free-text "special instructions" field.

Draft pipeline: Global config → override with property config → pull knowledge from FAQ + Guidebook + Learned Memory → generate draft.

---

## 3. Inbox Layout

### 3.1 Desktop (≥ md breakpoint)

- **App shell**: existing left nav sidebar (`w-56`). A collapse toggle shrinks it to icon-only (`w-14`) to give more room to the inbox columns when desired. Default state is full nav.
- **Inbox page**: fills the `main` content area with a two-column layout rendered as a client component (required for real-time filter switching, search, and draft updates).
  - **Left column (30%)**: conversation list
  - **Right column (70%)**: thread + AI draft panel

### 3.2 Left Column — Conversation List

- Search bar (filter by guest name or property)
- Filter tabs: **All** | **Unreplied** | **AI Ready** (with count badge)
  - **Unreplied**: conversations where the most recent message has `senderType = 'guest'` (i.e. no subsequent host reply)
  - **AI Ready**: conversations where an unreplied guest message exists AND a draft has already been generated (`messages.suggestion IS NOT NULL` on that message row)
- Each conversation item shows:
  - Guest name + unread dot (if unreplied by the definition above)
  - Last message preview (truncated)
  - Property name
  - Status badge: `✦ AI draft` (blue) | `unreplied` (red) | `replied` (dimmed)
  - Relative timestamp
- Selected item highlighted with left border accent

### 3.3 Right Column — Thread + AI Draft

**Thread header:**

- Guest avatar (initials), name, property, check-in/out dates, platform
- Quick-access buttons: Reservation · Guidebook · Memory (opens slide-over panels)

**Message thread:**

- Guest messages: left-aligned, dark card with border
- Host messages: right-aligned, blue background
- Latest unreplied guest message highlighted with blue border + "needs reply" badge
- Infinite scroll (load older messages on scroll up)

**AI Draft Panel (bottom of right column):**

- Appears automatically when an unreplied guest message exists
- Shows which knowledge sources were used (e.g. "generated from Guidebook + Memory")
- Draft text (read-only display)
- Action row: **Approve & Send** | **↺ Regenerate** | **✕ Dismiss**
- Quick hint chips: Shorter · No emoji · More formal · More friendly · + Add detail
- Extra context field: free-text input for situational details (e.g. "pool is warm today, will be ready by 8am")
- Regenerate picks up active chips + extra context
- Manual reply bar below: free-text input + Send button (bypasses AI draft)

### 3.4 Mobile (< md breakpoint)

- Default view: full-screen conversation list (same data as left column)
- Tap a conversation: slides to full-screen thread + AI draft panel (same as right column)
- Back button returns to list; scroll position and active filter tab are preserved in component state
- Uses existing bottom nav bar

---

## 4. AI Draft Generation

### 4.1 Trigger

Auto-generate a draft when a new guest message arrives with no existing host reply. Drafts are generated server-side and stored in the `messages.suggestion` field (already exists in schema) on the triggering guest message row.

### 4.2 Generation Inputs

1. Full conversation history for the reservation
2. Property FAQ entries
3. Property Guidebook entries (Markdown text + media URLs) — matched by keyword/substring against the guest message for v1; no embeddings required
4. Property Learned Memory facts
5. Property Agent Config (tone, emoji, special instructions)
6. Global Agent Config (fallback)
7. Reservation context (guest name, check-in/out, property name)

### 4.3 Regeneration with Hints

When the user clicks Regenerate, the client calls `POST /api/inbox/[reservationId]/suggest` with an updated body:

```ts
{
  messageId: string;           // ID of the triggering guest message
  chips?: string[];            // e.g. ["shorter", "no_emoji", "formal"]
  extraContext?: string;       // free-text situational context
}
```

The endpoint generates a new draft and overwrites `messages.suggestion` on the triggering message row. `messages.suggestionGeneratedAt` is also updated. The response returns the new draft text.

### 4.4 Approve & Send (v1)

`POST /api/inbox/[reservationId]/send`

Request body:

```ts
{
  suggestion: string;
}
```

v1 behavior:

1. Save a new row to `walt.messages` with `senderType = 'host'`, `body = suggestion`, `createdAt = now()`
2. Return `{ ok: true, body: suggestion }` — the client copies the text to clipboard and shows a toast: "Copied to clipboard — send in Hospitable"

Sending directly via the Hospitable API is deferred to a future milestone.

---

## 5. Learning Detection & Memory

### 5.1 Detection

After a reply is sent (client receives `200` from `/send`), if `extraContext` or chips were used, the client calls `POST /api/properties/[id]/memory/detect` asynchronously (fire-and-forget from the UI perspective; the send is not blocked by it).

Request body:

```ts
{
  hintText?: string; // extraContext field value — omit or empty string if only chips were used
  chips: string[]; // active chips (may be empty array)
  reservationId: string; // for provenance
}
```

If `hintText` is absent or empty and `chips` is the only signal, the server skips LLM classification (no learnable facts in chips alone) and returns `{ facts: [] }`.

Response:

```ts
{
  facts: Array<{
    text: string;
    type: 'property_fact' | 'situational';
  }>;
}
```

The server uses the LLM to classify each piece of the hint text. Only `property_fact` items are returned in the toast; `situational` items are discarded server-side and included in the response purely for display purposes (shown dimmed).

### 5.2 Learning Toast

After the detect response arrives, if any `property_fact` items exist, a toast appears in the thread:

- Lists each `property_fact` with a blue badge
- Shows `situational` items dimmed with a grey badge
- Actions: **Save to Memory** | **Edit first** | **✕ Dismiss**

"Edit first" opens the fact text inline for editing before saving. Saving calls `POST /api/properties/[id]/memory`.

### 5.3 Memory Storage

`walt.property_memory` table:

- `id` — `uuid`, primary key
- `organizationId` — `text`, not null (scopes to tenant)
- `propertyId` — `text`, not null (matches `walt.properties.id` type)
- `fact` — `text`, not null
- `source` — `text`, not null: `learned` | `manual` (application-layer validation; plain `text` column consistent with existing schema conventions)
- `sourceReservationId` — `text`, nullable (FK to `walt.reservations.id`)
- `createdAt` — `timestamp with timezone`, not null

Memory facts are **immutable** — editing a fact before saving (§5.2 "Edit first") creates a new row with the edited text; no `updatedAt` column is needed.

Index on `(organizationId)` for all three new tables, consistent with `task_categories` and `tasks` conventions.

### 5.4 Memory Panel

Accessible via the "Memory" button in the thread header. Shows all facts for the current property:

- Fact text, source (learned from \[guest\] · \[date\] or Added manually · \[date\])
- Delete button per entry
- "+ Add manually" button

---

## 6. Digital Guidebook

### 6.1 Structure

Per-property. Lives at `/properties/[id]/guidebook`.

`walt.guidebook_entries` table:

- `id` — `uuid`, primary key
- `organizationId` — `text`, not null
- `propertyId` — `text`, not null (matches `walt.properties.id` type)
- `category` — `text`, not null (free-text, e.g. "Amenities", "Access", "House Rules")
- `title` — `text`, not null
- `description` — `text`, not null — stored as **Markdown** (plain prose with optional formatting; no rich-text editor required for v1)
- `mediaUrl` — `text`, nullable (video or link URL)
- `aiUseCount` — `integer`, default 0
- `lastUsedAt` — `timestamp with timezone`, nullable
- `createdAt` — `timestamp with timezone`, not null
- `updatedAt` — `timestamp with timezone`, not null

### 6.2 UI

- Left panel: entry list grouped by category, with "+ Add entry" button
- Right panel: entry detail with description (rendered Markdown), optional media link, AI usage indicator ("AI has used this entry N times")
- Edit/Delete actions per entry
- Categories are free-text (user defines them)

### 6.3 AI Integration

When generating a draft, the AI searches guidebook entries for the current property using **keyword/substring matching** against the guest message text (v1). Matching entries' `description` fields (Markdown) are included verbatim in the generation prompt. If a matching entry has a `mediaUrl`, the AI may include it in the reply. `aiUseCount` and `lastUsedAt` are incremented when an entry is used.

---

## 7. Agent Configuration

### 7.1 Global Config

Lives at `/settings/agent`. Applies to all properties within the organization.

Fields:

- **Tone**: Warm & Friendly | Neutral | Formal
- **Emoji use**: None | Light | Friendly
- **Response length**: Concise | Balanced | Detailed
- **Escalation rules**: free-text — when should the AI flag a conversation for manual review

### 7.2 Per-Property Config

Lives at `/properties/[id]/agent`. Inherits all global values; only overridden fields are stored.

Additional fields:

- **Special instructions**: free-text (e.g. "This is a luxury property. Always address guests by first name.")
- **Property-specific escalation additions**: appended to global escalation rules

Inherited (non-overridden) fields are shown dimmed with a "← global" indicator.

### 7.3 Storage

`walt.agent_configs` table:

- `id` — `uuid`, primary key
- `organizationId` — `text`, not null
- `scope` — `text` enum: `global` | `property`
- `propertyId` — `text`, nullable (null for global scope; matches `walt.properties.id` type)
- `tone` — `text`, nullable
- `emojiUse` — `text`, nullable
- `responseLength` — `text`, nullable
- `escalationRules` — `text`, nullable
- `specialInstructions` — `text`, nullable
- `createdAt` — `timestamp with timezone`, not null
- `updatedAt` — `timestamp with timezone`, not null

Uniqueness: one global config per org (partial unique index `WHERE scope = 'global'` on `organizationId`), one per-property config per org+property (partial unique index `WHERE scope = 'property'` on `(organizationId, propertyId)`). PostgreSQL `NULL != NULL` in standard unique indexes so a partial index approach is required to prevent duplicate global rows.

---

## 8. Database Schema Changes

| Table                    | Change                                                     |
| ------------------------ | ---------------------------------------------------------- |
| `walt.guidebook_entries` | New — see §6.1                                             |
| `walt.property_memory`   | New — see §5.3                                             |
| `walt.agent_configs`     | New — see §7.3                                             |
| `walt.messages`          | No change (suggestion/suggestionGeneratedAt already exist) |

Drizzle migrations required for the three new tables.

---

## 9. Routes

| Route                                                 | Description                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/inbox`                                      | Paginated conversation list — new client-facing endpoint for two-column inbox            |
| `GET /api/inbox/[reservationId]/messages`             | Existing — paginated message thread                                                      |
| `POST /api/inbox/[reservationId]/suggest`             | Extended — now accepts optional `chips` and `extraContext`; overwrites draft on same row |
| `POST /api/inbox/[reservationId]/send`                | New — v1: saves host message to DB, returns body for clipboard copy                      |
| `GET/POST /api/properties/[id]/guidebook`             | List and create guidebook entries                                                        |
| `PUT/DELETE /api/properties/[id]/guidebook/[entryId]` | Update or delete entry                                                                   |
| `GET/POST /api/properties/[id]/memory`                | List and create memory facts                                                             |
| `DELETE /api/properties/[id]/memory/[factId]`         | Delete a memory fact                                                                     |
| `POST /api/properties/[id]/memory/detect`             | Classify hint text into property_fact vs situational — see §5.1 for request/response     |
| `GET/PUT /api/agent-config`                           | Global agent config (scoped to organization)                                             |
| `GET/PUT /api/properties/[id]/agent-config`           | Per-property agent config                                                                |

`GET /api/inbox` query params: `filter` (all | unreplied | ai_ready), `search` (string), `page`, `per_page`. Offset pagination is accepted as a v1 trade-off; real-time inserts may occasionally cause duplicates during rapid refresh, which is acceptable at this scale.

`GET /api/inbox/[reservationId]/messages` query params: `before` (ISO timestamp cursor — load messages created before this timestamp), `limit` (default 20). Infinite scroll loads older messages by passing the `createdAt` of the oldest currently loaded message as `before`. The unread dot and "unreplied" badge are the same concept — both indicate the most recent message in the thread has `senderType = 'guest'`.

---

## 10. Pages

| Page                         | Description                              |
| ---------------------------- | ---------------------------------------- |
| `/inbox`                     | Two-column inbox (replaces current list) |
| `/properties/[id]/guidebook` | Digital Guidebook per property           |
| `/properties/[id]/agent`     | Per-property agent config                |
| `/settings/agent`            | Global agent config                      |

---

## 11. Out of Scope (this spec)

- Sending replies directly via Hospitable API (deferred — v1 uses clipboard copy)
- Vector embeddings / semantic search for guidebook (v1 uses keyword matching)
- AI-generated proactive messages (check-in tips, etc.)
- Review response drafting
- Multi-language support
