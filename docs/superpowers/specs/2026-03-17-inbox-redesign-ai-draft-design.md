# Inbox Redesign + AI Draft + Guidebook + Agent Config

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Inbox UI redesign, AI reply drafting, learning memory, digital guidebook, global and per-property agent configuration

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

- **App shell**: existing left nav sidebar (`w-56`). A collapse toggle shrinks it to icon-only (`w-14`) to give more room to the inbox columns when desired.
- **Inbox page**: fills the `main` content area with a two-column layout.
  - **Left column (30%)**: conversation list
  - **Right column (70%)**: thread + AI draft panel

### 3.2 Left Column — Conversation List

- Search bar (filter by guest name or property)
- Filter tabs: **All** | **Unreplied** | **AI Ready** (with count badge)
- Each conversation item shows:
  - Guest name + unread dot (if unreplied guest message)
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
- Back button returns to list
- Uses existing bottom nav bar

---

## 4. AI Draft Generation

### 4.1 Trigger

Auto-generate a draft when a new guest message arrives with no existing host reply. Drafts are generated server-side and stored in the `messages.suggestion` field (already exists in schema).

### 4.2 Generation Inputs

1. Full conversation history for the reservation
2. Property FAQ entries
3. Property Guidebook entries (text + video links)
4. Property Learned Memory
5. Property Agent Config (tone, emoji, special instructions)
6. Global Agent Config (fallback)
7. Reservation context (guest name, check-in/out, property name)

### 4.3 Regeneration with Hints

When the user clicks Regenerate:

- Active chips are sent as style modifiers (e.g. `shorter`, `no_emoji`, `formal`)
- Extra context field content is appended as additional context
- A new draft is generated and replaces the previous one

### 4.4 Approve & Send

Clicking "Approve & Send" sends the draft as a host reply via the Hospitable API (future) or copies to clipboard (v1). The message is saved to `walt.messages` with `sender_type = 'host'`.

---

## 5. Learning Detection & Memory

### 5.1 Detection

After a reply is sent that included extra context or chips, the AI analyses the hint text and classifies each piece as:

- **Property fact** — a standing truth about the property (e.g. "pool takes 24–48 hours to heat"). Offered for saving.
- **One-off / situational** — context specific to this moment (e.g. "it's warm today"). Auto-discarded, not offered.

### 5.2 Learning Toast

After sending, if property facts were detected, a toast appears in the thread:

- Lists each detected fact with a `Property fact` badge
- Shows discarded situational items dimmed with a `One-off` badge
- Actions: **Save to Memory** | **Edit first** | **✕ Dismiss**

"Edit first" opens the fact inline for editing before saving.

### 5.3 Memory Storage

Saved facts are stored in `walt.property_memory`:

- `id`, `property_id`, `fact` (text), `source` (learned | manual), `source_context` (reservation ID or null), `created_at`

### 5.4 Memory Panel

Accessible via the "Memory" button in the thread header. Shows all facts for the current property:

- Fact text, source (learned from [guest] · [date] or Added manually · [date])
- Delete button per entry
- "+ Add manually" button

---

## 6. Digital Guidebook

### 6.1 Structure

Per-property. Lives at `/properties/[id]/guidebook`.

Each entry:

- `id`, `property_id`, `category` (text, e.g. "Amenities", "Access", "House Rules"), `title`, `description` (rich text), `media_url` (optional video/link), `ai_use_count`, `last_used_at`, `created_at`, `updated_at`

### 6.2 UI

- Left panel: entry list grouped by category, with "+ Add entry" button
- Right panel: entry detail with description, optional media link, AI usage indicator ("AI has used this entry N times")
- Edit/Delete actions per entry
- Categories are free-text (user defines them)

### 6.3 AI Integration

When generating a draft, the AI searches guidebook entries for the current property by semantic relevance to the guest message. Matching entries are included in the generation context. If a video link is found in a matching entry, the AI may include it in the reply.

---

## 7. Agent Configuration

### 7.1 Global Config

Lives at `/settings/agent`. Applies to all properties.

Fields:

- **Tone**: Warm & Friendly | Neutral | Formal
- **Emoji use**: None | Light | Friendly
- **Response length**: Concise | Balanced | Detailed
- **Escalation rules**: free-text — when should the AI flag a conversation for manual review

### 7.2 Per-Property Config

Lives at `/properties/[id]/agent`. Inherits all global values; only overridden fields are stored.

Additional field:

- **Special instructions**: free-text (e.g. "This is a luxury property. Always address guests by first name.")
- **Property-specific escalation additions**: appended to global escalation rules

Inherited (non-overridden) fields are shown dimmed with a "← global" indicator.

### 7.3 Storage

`walt.agent_configs` table:

- `id`, `scope` (global | property), `property_id` (null for global), `tone`, `emoji_use`, `response_length`, `escalation_rules`, `special_instructions`, `created_at`, `updated_at`

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

## 9. New Routes

| Route                                                 | Description                                     |
| ----------------------------------------------------- | ----------------------------------------------- |
| `GET/POST /api/inbox`                                 | Paginated conversation list with filter support |
| `GET /api/inbox/[reservationId]/messages`             | Existing — paginated message thread             |
| `POST /api/inbox/[reservationId]/suggest`             | Existing — generate/regenerate AI draft         |
| `POST /api/inbox/[reservationId]/send`                | New — approve and send a draft                  |
| `GET/POST /api/properties/[id]/guidebook`             | List and create guidebook entries               |
| `PUT/DELETE /api/properties/[id]/guidebook/[entryId]` | Update or delete entry                          |
| `GET/POST /api/properties/[id]/memory`                | List and create memory facts                    |
| `DELETE /api/properties/[id]/memory/[factId]`         | Delete a memory fact                            |
| `POST /api/properties/[id]/memory/detect`             | Detect learnings from hint text                 |
| `GET/PUT /api/agent-config`                           | Global agent config                             |
| `GET/PUT /api/properties/[id]/agent-config`           | Per-property agent config                       |

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

- Sending replies directly via Hospitable API (v1: copy to clipboard or manual send)
- AI-generated proactive messages (check-in tips, etc.)
- Review response drafting
- Multi-language support
