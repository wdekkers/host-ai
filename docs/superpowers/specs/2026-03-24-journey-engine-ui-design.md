# Journey Engine UI — Design Spec

> **Date:** 2026-03-24
> **Status:** Draft
> **Scope:** Frontend for journey engine, upsell dashboard, notification center, inbox AI controls
> **Backend spec:** `docs/superpowers/specs/2026-03-24-ai-native-journey-engine-design.md`
> **Backend plan:** `docs/superpowers/plans/2026-03-24-ai-native-journey-engine.md`

---

## 1. Overview

### Problem

The journey engine backend is complete but has no UI. Hosts cannot create, manage, or monitor journeys, upsells, or notifications without a frontend.

### Solution

Six UI areas that follow existing Hostpilot patterns (shadcn components, Lucide icons, Card-based layouts, sky-600 accent) with one key differentiator: **all journey creation and editing happens through conversational AI, not forms or drag-and-drop builders.**

### Design Principles

- **AI-first** — no manual step editors. Hosts describe what they want, AI builds it.
- **Consistent** — follows `docs/ui-standards.md` exactly. shadcn Card/Badge/Button, Lucide icons, existing layout patterns.
- **Actionable** — surfaces what needs attention (upsells to confirm, journeys to promote, escalations to handle).

---

## 2. Navigation Changes

### Sidebar

Add two items to the **Operations** nav group in `apps/web/src/lib/nav-links.ts`. The actual Operations group contains: Calendar, Reservations, Properties, Checklists, Inventory, Contacts. Add Journeys and Upsells after Properties (before Checklists):

| Label | Route | Icon | Position | Roles |
|-------|-------|------|----------|-------|
| Journeys | `/journeys` | `Zap` | After Properties | `['owner', 'manager']` |
| Upsells | `/upsells` | `TrendingUp` | After Journeys | `['owner', 'manager']` |

Both use standard sidebar styling: `h-4 w-4` icon, no special colors, rendered via `SidebarMenuButton`. Roles restricted to owner/manager since these are automation and revenue features.

### Top Header Bar

Add a notification bell to the right side of the header bar in `apps/web/src/app/app-chrome.tsx`:

- `Bell` icon from lucide-react (`h-5 w-5 text-slate-500`)
- Red badge with unread count (hidden when 0)
- Click opens notification dropdown (see Section 6)
- Positioned left of the user avatar

### New Routes

| Route | Page | Description |
|-------|------|-------------|
| `/journeys` | Journeys list | AI prompt + journey cards |
| `/journeys/[id]` | Journey detail | Steps timeline + AI edit + config |
| `/upsells` | Upsell dashboard | Revenue stats + action items + history |

### Modified Pages

| Page | Change |
|------|--------|
| `/inbox` | AI pause toggle added to conversation header |
| App chrome (all pages) | Notification bell added to top bar |

---

## 3. Journeys List Page (`/journeys`)

### Layout

Standard `space-y-5` page layout:

1. **Page heading** — "Journeys" + subtitle "Automate your guest communication lifecycle"
2. **AI prompt input** (hero section)
3. **Stat cards** (4-column grid)
4. **Filter tabs** (pill tabs)
5. **Journey cards** (vertical list)

### AI Prompt Input

The primary CTA — a prominent Card at the top of the page:

- Icon badge: `Sparkles` icon in `bg-sky-50` circle
- Label: "Describe what you want to automate"
- Textarea input with placeholder showing a real example: *"Send a welcome message when a guest books, check-in instructions 2 days before arrival, and ask for a review after checkout if the stay went well..."*
- "Use template" link below the input — opens a dropdown/sheet with pre-built prompt templates:
  - Full guest lifecycle
  - Gap night upsell
  - Early check-in / late checkout
  - Escalation flow
  - Review request
- "Generate Journey" primary Button on the right

**On submit:** POST to `/api/journeys/generate`, show loading state, then navigate to `/journeys/[id]` to review the generated journey.

### Stat Cards

`grid grid-cols-2 gap-3 sm:grid-cols-4` — standard pattern from Today page:

| Stat | Icon | Icon BG |
|------|------|---------|
| Active (count) | `Zap` | `bg-sky-50` |
| Paused (count) | `Pause` | `bg-amber-50` |
| Messages Sent (count) | `Mail` | `bg-sky-50` |
| Approval Rate (%) | `CheckCircle` | `bg-green-50` |

Stat text: `text-2xl font-bold text-slate-900`. Label: `text-xs font-medium uppercase tracking-wide text-slate-400`.

### Filter Tabs

Pill tabs matching the Settings page pattern:

- All (N) — active by default (dark background)
- Active (N)
- Paused (N)
- Draft (N)

### Journey Cards

Card per journey, clickable (navigates to `/journeys/[id]`):

```
┌──────────────────────────────────────────────────────────────┐
│ Guest Welcome Journey    [Active badge] [Draft mode badge]   │
│ Booking → pre-arrival → check-in → mid-stay → checkout      │
│                                                  All props   │
│ ⚡ booking_confirmed · 📝 6 steps · 👥 12 enrolled · ✉ 89 msgs · ✏ 3% edit │
└──────────────────────────────────────────────────────────────┘
```

- **Name** — `text-sm font-semibold`
- **Status badge** — `Badge` component: Active (green), Paused (amber), Draft (gray), Archived (gray outline)
- **Approval mode badge** — Draft mode (sky/blue), Auto mode (amber), Autonomous (green)
- **Description** — `text-xs text-slate-500`
- **Properties** — right-aligned, `text-xs text-slate-400`
- **Metrics row** — `text-xs text-slate-400` with Lucide icons `h-3 w-3`: trigger type, step count, enrollment count, messages count, edit rate (or revenue for upsell journeys)

**Backend dependency:** The `/api/journeys` endpoint currently returns raw journey rows without aggregate metrics (enrollment count, message count, edit rate). The implementation plan must extend this endpoint with aggregate subqueries joining `journey_enrollments` and `journey_execution_log`, or provide a separate `/api/journeys/stats` endpoint that returns per-journey aggregates.

---

## 4. Journey Detail Page (`/journeys/[id]`)

### Layout

1. **Back link** — "← Back to Journeys" (`text-xs text-slate-500`)
2. **Page heading** — journey name + status badge + approval mode badge
3. **Action buttons** — Pause / Archive (right-aligned, `Button variant="outline"`)
4. **Stat cards** (4-column grid)
5. **Two-column layout** — Steps timeline (left) + AI edit panel + config (right)

### Stat Cards

| Stat | Description |
|------|-------------|
| Active Enrollments | Guests currently in this journey |
| Messages Drafted | Total messages generated |
| Edit Rate | % of messages edited before sending |
| Completed | Total enrollments that ran to completion |

### Steps Timeline (Left Column)

A Card containing the step list as a vertical timeline:

- **Header** — "Steps" + step count + trigger type
- **Each step** — numbered circle + vertical connector line + step details

Step circle colors by type:
| Type | Circle color |
|------|-------------|
| `send_message` | sky/blue (`bg-sky-50 border-sky-600`) |
| `wait` | amber (`bg-amber-50 border-amber-600`) |
| `ai_decision` | purple (`bg-purple-50 border-purple-600`) |
| `create_task` | green (`bg-green-50 border-green-600`) |
| `send_notification` | slate (`bg-slate-50 border-slate-600`) |
| `upsell_offer` | sky/blue (same as send_message) |
| `pause_ai` / `resume_ai` | amber |

Each step shows:
- **Step type** — `text-xs font-semibold`
- **Timing badge** — `text-xs text-slate-400 bg-slate-50` (e.g., "on trigger", "until 48h before check-in", "day after check-in")
- **Directive** — `text-xs text-slate-500` — the natural language instruction, displayed in quotes

### AI Edit Panel (Right Column, Top)

A Card with:
- **Header** — "Edit with AI"
- **Textarea** — placeholder: *"Add a step after check-in that offers a late checkout if the next night is free..."*
- **"Apply Changes" Button** — primary, right-aligned
- On submit: POST to `/api/journeys/generate/edit`, show updated steps preview, host confirms

### Configuration Card (Right Column, Middle)

A Card with key-value rows (`divide-y`):

| Key | Value |
|-----|-------|
| Trigger | `booking_confirmed` |
| Properties | All properties (or comma-separated names) |
| Approval Mode | Draft / Auto with exceptions / Autonomous |
| Coverage | Always active (or window description) |
| Version | v3 · Updated 2h ago |

**Approval Mode row** — if metrics suggest promotion (e.g., >50 messages, <5% edit rate), show an inline link: "Upgrade suggested (96% approval)" in `text-xs text-primary`.

### Promotion Banner (Right Column, Bottom)

When promotion is suggested, show an amber Card:

- Icon: `Info` in amber circle
- Title: "Ready for auto mode?" — `text-xs font-semibold`
- Body: "This journey has 89 messages with only a 3% edit rate. Consider upgrading to Auto with exceptions to save time."
- Buttons: "Upgrade to Auto" (primary amber) + "Not now" (outline)
- On click: PUT to `/api/journeys/[id]` with `approvalMode: 'auto_with_exceptions'`

---

## 5. Upsell Dashboard (`/upsells`)

### Layout

1. **Page heading** — "Upsells" + subtitle
2. **Property filter** — dropdown to filter stats and list by property ("All properties" default)
3. **Revenue stat cards** (4-column grid)
4. **Tabs** — "Needs Action" / "History"
5. **Content area** — action items or history list

### Property Filter

A `select` or dropdown above the stat cards:
- "All properties" (default)
- Lists all org properties
- Selecting a property filters both the stat cards and the list below

### Revenue Stat Cards

| Stat | Icon | Icon BG | Description |
|------|------|---------|-------------|
| Revenue This Month | `DollarSign` | `bg-sky-50` | Sum of `actualRevenue` for accepted upsells |
| Accepted | `Check` | `bg-green-50` | Count of accepted upsells |
| Total Offered | `Activity` | `bg-amber-50` | Count of all offered upsells |
| Acceptance Rate | `Percent` | `bg-slate-50` | Accepted / Offered percentage |

All stats respect the property filter.

**Backend dependency:** The `/api/upsells/stats` endpoint currently returns all-time totals without property or date-range filtering. The implementation plan must extend it to accept `?propertyId=` and `?month=YYYY-MM` query parameters. The `/api/upsells` list endpoint must also join with `reservations` to return guest names (currently only stores `reservationId`).

### Needs Action Tab

A Card with `divide-y` list of accepted upsells awaiting host confirmation:

Each item:
- **Icon** — green check circle (`bg-green-50`)
- **Title** — "[Guest name] accepted [upsell type]" — `text-sm font-semibold`
- **Details** — property + dates + offer details — `text-xs text-slate-500`
- **Time** — "Accepted 2 hours ago" — `text-xs text-slate-400`
- **CTA** — "Confirm & Log Revenue" `Button` (primary, right-aligned)

**"Confirm & Log Revenue" flow:**
1. Click opens a small dialog/sheet
2. Shows the offer details (type, estimated amount)
3. Input for actual revenue amount (pre-filled with estimate)
4. "Confirm" button — PUT to `/api/upsells/[id]` with `status: 'accepted'`, `actualRevenue`
5. Item disappears from Needs Action, stats update

### History Tab

A table/card list of all upsell events:
- Columns: Guest, Property, Type, Status, Offered Amount, Actual Revenue, Date
- Filter by: status (offered/accepted/declined/expired), type (gap_night/early_checkin/etc.)
- Follows the responsive table/card pattern from Reservations page (table on desktop, card list on mobile)

---

## 6. Notification Center

### Bell Icon + Dropdown

In the top header bar:

- `Bell` icon (`h-5 w-5 text-slate-500`)
- Red badge with unread count — `bg-red-500 text-white text-[9px] font-bold` — positioned top-right of bell. Hidden when count is 0.
- Click opens dropdown panel (320-360px wide, positioned below bell)

**Dropdown contents:**
- **Header** — "Notifications" + "Mark all read" link (`text-xs text-primary`)
- **Notification list** — most recent 5-8 notifications
- **Each item:**
  - Unread indicator: blue dot (`bg-primary`) for unread, none for read
  - Category badge: colored per category
    - URGENT — red (`bg-red-50 text-red-600`)
    - UPSELL — green (`bg-green-50 text-green-800`)
    - JOURNEY — amber (`bg-amber-50 text-amber-800`)
    - TASK — slate (`bg-slate-100 text-slate-600`)
    - SYSTEM — slate
  - Relative time — `text-xs text-slate-400`
  - Title — `text-xs font-medium`
  - Body — `text-xs text-slate-500`
  - Read items shown at reduced opacity
- **Footer** — "View all notifications" link → full notifications page
- **Click notification** — marks as read (PUT `/api/notifications/[id]/read`) and navigates to relevant page

### Toast Notifications (Urgent)

For urgent notifications. Since the `notifications` table has no `urgency` column, urgency is derived from the `category` field: category `'escalation'` = urgent (shows toast). All other categories use the bell dropdown only.

Triggered when a new notification with `category: 'escalation'` is detected:

- Appears bottom-right of viewport
- Red left border (`border-l-4 border-red-500`) + subtle shadow
- `AlertTriangle` icon in red circle
- Title + body text
- "View conversation" link — navigates to the relevant inbox conversation
- Close button (×)
- Auto-dismiss after 10 seconds

Implementation: use a global toast provider in `app-chrome.tsx` that polls for new high-urgency notifications (or uses the web notifications table with polling).

### Notification Preferences Page

Accessible from "View all notifications" → settings gear icon, or from `/settings/notifications`:

- List of categories: Escalation, Upsell, Task, Journey, System
- For each category: multi-select of channels (SMS, Email, Slack, Web)
- Quiet hours toggle with timezone, start hour, end hour
- Save button

Simple form layout, consistent with Agent Settings pattern.

---

## 7. Inbox AI Controls

### AI Status Toggle

Added to the conversation header in `ConversationThread.tsx`, right side:

**When active:**
- Green pill: `bg-green-50 border border-green-200 rounded-md px-2.5 py-1.5`
- Green dot indicator (8px)
- Text: "AI Active" — `text-xs font-medium text-green-800`
- Chevron down icon for dropdown

**When paused:**
- Amber pill: `bg-amber-50 border border-amber-200`
- Amber dot indicator
- Text: "AI Paused" — `text-xs font-medium text-amber-800`
- Click to resume

### Pause Dropdown

On click when active, shows a dropdown:
- Header: "Pause AI for this conversation"
- Options: 15 minutes, 1 hour, 24 hours, Until I resume
- Each option calls PUT `/api/conversations/[reservationId]/ai-status` with `status: 'paused'`

**Backend dependency:** The current backend handler does not compute `aiPausedUntil` from duration. This needs to be fixed as part of the implementation plan: the handler should accept `pauseDurationMinutes` and set `aiPausedUntil = now + duration`. Until fixed, all pauses are indefinite (resume manually).
- Dropdown closes, pill changes to amber "AI Paused"

### Resume

When paused, clicking the pill resumes immediately:
- PUT `/api/conversations/[reservationId]/ai-status` with `status: 'active'`
- Pill changes back to green "AI Active"

### Behavior When Paused

- AI drafts are not generated for this conversation
- Intent/escalation analysis still runs (so tasks are still suggested)
- Journey steps that would send a message are deferred until resumed
- The pause is per-conversation, not global

---

## 8. Component Inventory

### New Components to Create

| Component | Location | Description |
|-----------|----------|-------------|
| `JourneyPromptInput` | `components/journeys/` | AI prompt textarea with template picker and generate button |
| `JourneyCard` | `components/journeys/` | Journey list item card with status, metrics |
| `JourneyStepTimeline` | `components/journeys/` | Vertical step timeline with colored circles |
| `JourneyAiEditPanel` | `components/journeys/` | Conversational edit textarea + apply button |
| `JourneyConfigCard` | `components/journeys/` | Read-only key-value config display |
| `PromotionBanner` | `components/journeys/` | Amber approval mode upgrade suggestion |
| `UpsellActionItem` | `components/upsells/` | Accepted upsell card with confirm CTA |
| `UpsellConfirmDialog` | `components/upsells/` | Revenue confirmation dialog/sheet |
| `NotificationBell` | `components/notifications/` | Bell icon with badge + dropdown |
| `NotificationDropdown` | `components/notifications/` | Dropdown panel with notification list |
| `NotificationItem` | `components/notifications/` | Single notification row with category badge |
| `UrgentToast` | `components/notifications/` | Bottom-right urgent notification toast |
| `ToastProvider` | `components/notifications/` | Global toast manager in app chrome |
| `AiStatusToggle` | `components/inbox/` | Green/amber pill toggle for conversation AI status |
| `AiPauseDropdown` | `components/inbox/` | Duration picker dropdown |
| `PropertyFilter` | `components/shared/` | Reusable property dropdown filter |

### Existing Components Used

| Component | From | Usage |
|-----------|------|-------|
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `ui/card` | All page layouts |
| `Badge` | `ui/badge` | Status labels, category tags, counts |
| `Button` | `ui/button` | CTAs, actions |
| `Sidebar*` | `ui/sidebar` | Navigation |
| `Input` | `ui/input` | Form fields |

### shadcn Components to Add

| Component | Needed for |
|-----------|-----------|
| `DropdownMenu` | Notification bell dropdown, AI pause dropdown, property filter |
| `Dialog` or `Sheet` | Upsell confirm dialog, template picker |
| `Tabs` | Upsell dashboard tabs |
| `Select` | Property filter, notification preferences |
| `Textarea` | AI prompt input, AI edit panel |
| `Toast` / `Sonner` | Urgent notification toasts |

Install via: `cd apps/web && npx shadcn@latest add dropdown-menu dialog tabs select textarea sonner`

---

## 9. Data Fetching Pattern

All pages use the existing pattern: server components fetch data, pass to client components.

### API Endpoints Used

| Page | Endpoint | Method |
|------|----------|--------|
| Journeys list | `/api/journeys` | GET |
| Journey generate | `/api/journeys/generate` | POST |
| Journey detail | `/api/journeys/[id]` | GET |
| Journey edit | `/api/journeys/generate/edit` | POST |
| Journey update | `/api/journeys/[id]` | PUT |
| Journey activate | `/api/journeys/[id]/activate` | POST |
| Journey pause | `/api/journeys/[id]/pause` | POST |
| Journey exclude | `/api/journeys/[id]/exclude` | POST |
| Upsell list | `/api/upsells` | GET |
| Upsell update | `/api/upsells/[id]` | PUT |
| Upsell stats | `/api/upsells/stats` | GET |
| Notifications list | `/api/notifications` | GET |
| Notification read | `/api/notifications/[id]/read` | PUT |
| Read all | `/api/notifications/read-all` | PUT |
| Unread count | `/api/notifications` | GET (returns `unreadCount`) |
| Preferences | `/api/notifications/preferences` | GET/PUT |
| AI status | `/api/conversations/[reservationId]/ai-status` | PUT |

### Polling

- **Notification bell**: Poll `/api/notifications` every 30 seconds for unread count (or use the existing fetch pattern with SWR/React Query if available)
- **Urgent toast**: Check for new notifications with `category: 'escalation'` in the same poll
- **Polling optimization**: Only poll when the browser tab is active (`document.visibilityState === 'visible'`)

---

## 10. Backend Changes Required

These backend changes are prerequisites for the UI and must be included in the implementation plan:

| Change | Endpoint | Description |
|--------|----------|-------------|
| Journey metrics aggregation | `GET /api/journeys` | Add subqueries to return `enrollmentCount`, `messageCount`, `editRate` per journey from `journey_enrollments` and `journey_execution_log` |
| Upsell stats filtering | `GET /api/upsells/stats` | Add `?propertyId=` and `?month=YYYY-MM` query parameters |
| Upsell guest names | `GET /api/upsells` | Join with `reservations` to return `guestFirstName`, `guestLastName`, `propertyName` |
| AI status duration | `PUT /api/conversations/[reservationId]/ai-status` | Fix handler to compute `aiPausedUntil = now + pauseDurationMinutes` when provided |
| AI status GET | Conversation data fetch | Include current `aiStatus` and `aiPausedUntil` when loading a conversation (either new GET endpoint or include in existing conversation data) |
| Promotion flag | `GET /api/journeys/[id]` | Return `promotionSuggested: boolean` computed from message count and edit rate thresholds |

---

## 11. Out of Scope

- Visual journey builder (drag-and-drop step editor) — AI edit only
- Enrollment management UI (viewing/cancelling individual guest enrollments) — admin-level, defer
- Coverage schedule UI (time window picker) — can be set via AI edit for now ("set this journey to only run weekdays 9am-10pm")
- Notification preferences per team member — org-level only for v1
- Slack channel mapping UI — configure via Slack integration settings page (future)
- Mobile-specific optimizations beyond existing responsive patterns
