# Property To-Do List with AI Dictation — Design

**Status:** Draft
**Date:** 2026-04-28
**Owner:** Wesley

## Goal

Extend the existing `tasks` system into a global, filterable to-do list. Add a voice/text dictation input where the user can describe a walkthrough in free-form natural language and AI parses it into one or more structured tasks (title, description, property, category, priority, due date), shown in a preview the user confirms before persisting.

## Non-Goals (v1)

- Assignee extraction from transcripts
- Real-time streaming transcription
- Recurring tasks / templates
- Native mobile recording (web only; the future iOS app reuses the same API)

## Existing Infrastructure (no changes needed)

- `tasks` table with `propertyIds[]`, `categoryId`, `status`, `priority`, `dueDate`, `description`
- `taskCategories` table (per-org, named, colored)
- `task_audit_events` table

## Data Model Changes

### 1. `properties.nicknames text[] not null default '{}'`

Per-property aliases ("Palmera", "RC", "Rushing Creek") used by:

- The AI prompt context for property matching
- The list filter property selector (searchable by nickname)

Single Drizzle migration. No backfill required.

### 2. Property settings UI

Add a "Nicknames" chip-input field to the property settings page so the user can manage aliases.

## AI Flow

### Package: `@walt/ai`

New module (e.g. `parseTaskDictation`) — keeps `apps/web` thin and follows the pluggable-provider pattern (per project memory). Uses Claude Sonnet 4.6 via the Anthropic SDK with low temperature and JSON output validated by Zod.

### Inputs

- `transcript: string`
- `organizationId: string`
- Context loaded server-side and passed to the prompt:
  - Properties: `[{ id, name, nicknames }]`
  - Existing categories: `[{ id, name }]`
  - `today: ISO date` (so the model can resolve "Friday", "this weekend", etc.)

### Output (Zod-validated)

```ts
{
  tasks: Array<{
    title: string; // short imperative
    description: string | null; // verbatim sentence(s) from transcript
    propertyMatches: string[]; // property IDs (0..n)
    propertyAmbiguous: string | null; // raw mention if AI couldn't match
    categoryId: string | null; // existing category id, or null
    suggestedNewCategory: string | null; // proposed name if no fit
    priority: 'low' | 'medium' | 'high'; // default 'medium'
    dueDate: string | null; // ISO date
    confidence: 'high' | 'medium' | 'low';
  }>;
}
```

### Route: `POST /api/tasks/parse-dictation`

Per Next.js route conventions in CLAUDE.md, business logic lives in `handler.ts`.

Flow: auth → Zod-validate body → load org context → call `@walt/ai.parseTaskDictation` → server-side sanitize (drop unknown `categoryId` / `propertyMatches` IDs and convert to ambiguous markers) → return drafts.

**This route does not write to the DB.** Persistence happens only when the user approves drafts in the preview UI.

### Route: `POST /api/tasks/bulk`

Accepts an array of drafts (post-edit), creates rows in `tasks`, logs one `task_audit_events` row per task with `delta: { source: 'ai-dictation', ... }`. Returns per-row success/failure so the UI can keep failed drafts visible for retry.

Category creation (when user accepts a `suggestedNewCategory`) is upsert-by-`(organizationId, lower(name))` to avoid races.

## UI

### `/tasks` page

Layout, top to bottom:

1. **Dictation card**
   - Textarea (paste + iOS keyboard dictation always work)
   - Mic button: tries Web Speech API first; falls back to MediaRecorder → upload → Whisper if unavailable or declined
   - "Parse with AI" submits the transcript

2. **Preview drawer** (modal on desktop, full-screen sheet on mobile)
   - One row per draft with editable fields: title, description, property (multi-select, searchable by name + nicknames), category (dropdown including "Create '<X>'" for `suggestedNewCategory`), priority, due date
   - Warning chip on rows with `propertyAmbiguous` or `confidence: 'low'`
   - Per-row delete; bulk "Approve all" / "Cancel"
   - Approve → `POST /api/tasks/bulk` → list refreshes

3. **Filter bar**
   - Property (multi), category (multi), status, priority, due-date range, search
   - Filter state in the URL (`?property=…&category=…`) for shareable links

4. **Task list**
   - Table/list with inline status toggle, edit, delete
   - Page size 50

### Property pages

A `<TasksList propertyId={id} />` component renders the filtered list using the same data layer — single source of truth.

### Components

shadcn primitives only (`Card`, `Sidebar`, etc., per `docs/ui-standards.md`). Accent color `sky-600`. Lucide icons.

## Errors & Edge Cases

| Scenario                                   | Behavior                                                              |
| ------------------------------------------ | --------------------------------------------------------------------- |
| AI returns invalid JSON / Zod fail         | 422 with raw text; UI shows "Couldn't parse" and preserves transcript |
| Empty transcript / `tasks: []`             | "No tasks detected" inline; transcript preserved                      |
| AI references unknown category/property ID | Server drops it and marks the field ambiguous                         |
| Whisper upload / mic permission denied     | Fall back to textarea silently                                        |
| Bulk submit partial failure                | Per-row results returned; failed drafts stay in modal with error chip |
| Duplicate "Create category" clicks         | Upsert on `(organizationId, lower(name))`                             |

## Testing

- **`@walt/ai.parseTaskDictation`** — unit tests with fixture transcripts (single, multi-task, ambiguous property, new category, due-date phrasing). LLM client mocked; assert Zod-typed output.
- **`/api/tasks/parse-dictation` handler** — auth, Zod validation, ID sanitization.
- **`/api/tasks/bulk` handler** — real DB (per project standard: no mocked DBs in integration tests), including partial-failure path and category upsert race.
- **Nickname search matcher** — unit test for property filter dropdown.
- **UI** — minimal: render preview drawer with fixture drafts, approve, assert API call shape. No full E2E for v1.

## File / Package Plan

```
packages/ai/src/parseTaskDictation/
  index.ts
  prompt.ts
  schema.ts          // Zod
  parseTaskDictation.test.ts
  fixtures/

packages/db/migrations/
  XXXX_property_nicknames.sql

apps/web/src/app/api/tasks/parse-dictation/
  handler.ts
  handler.test.ts
  route.ts
apps/web/src/app/api/tasks/bulk/
  handler.ts
  handler.test.ts
  route.ts

apps/web/src/app/tasks/
  page.tsx                        // upgrade existing 14-line stub
  _components/
    DictationCard.tsx
    PreviewDrawer.tsx
    TasksList.tsx                  // reused by property pages
    TaskRow.tsx
    TaskFilters.tsx

apps/web/src/app/properties/[id]/
  // mount <TasksList propertyId={id} />
  // add Nicknames field to settings form
```

## Open Questions

None at design approval time. Open items will be resolved during plan-writing.
