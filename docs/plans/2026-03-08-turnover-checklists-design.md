# Turnover Checklist Feature Design

## Goal

Per-property checklist templates that generate shareable per-turnover runs for cleaners, with soft-delete and full audit trail.

## Architecture

Three new DB tables. Two new page routes. Two new API route groups. No auth required for the cleaner-facing run view.

## Data Model

### `checklist_items` (template)
Per-property checklist items defined by the host.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| propertyId | text | FK → properties.id |
| title | text | e.g. "Clean pool filters" |
| description | text | optional detail |
| sortOrder | integer | display order |
| deletedAt | timestamp | null = active, set = soft-deleted |
| createdAt | timestamp | |

### `checklist_runs`
One record per turnover. Created by the host, completed by the cleaner.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| propertyId | text | FK → properties.id |
| token | text UNIQUE | random slug for shareable URL |
| label | text | optional e.g. "April 5 turnover" |
| createdAt | timestamp | |
| createdBy | text | Clerk userId of host |
| completedAt | timestamp | null until cleaner finishes |

### `checklist_run_entries`
Audit trail — one row per item check/uncheck action.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| runId | uuid | FK → checklist_runs.id |
| itemId | uuid | FK → checklist_items.id |
| checked | boolean | true = checked, false = unchecked |
| checkedBy | text | name entered by cleaner |
| notes | text | optional note per item |
| createdAt | timestamp | when this action occurred |

The latest entry per (runId, itemId) is the current state. Full history = audit trail.

## Pages

### `/checklists` (host, requires login)
- Tabs or sections per property
- Manage template items (add, reorder, soft-delete)
- "New Run" button → creates run, shows shareable link
- Table of past runs: date, property, completed/pending, link to detail

### `/checklists/run/[token]` (public, no login)
- Shows property name + run label
- Cleaner enters their name once (stored in sessionStorage, pre-fills subsequent checks)
- List of checklist items with checkbox + optional note per item
- Each check saves immediately (optimistic UI)
- "All done" banner when everything is checked

## API Routes

### Host-facing (auth required)
- `GET /api/checklists/items?propertyId=` — list template items
- `POST /api/checklists/items` — create item
- `PATCH /api/checklists/items/[id]` — update title/description/sortOrder
- `DELETE /api/checklists/items/[id]` — soft-delete (sets deletedAt)
- `POST /api/checklists/runs` — create run, returns token
- `GET /api/checklists/runs?propertyId=` — list runs with completion status

### Cleaner-facing (no auth, token-gated)
- `GET /api/checklists/runs/[token]` — fetch run + current item states
- `POST /api/checklists/runs/[token]/check` — record a check/uncheck entry

## Soft Delete Behaviour
- Soft-deleted items are hidden from the template editor and from new runs
- Existing runs that include a soft-deleted item still show it (with a "removed" badge) so history is intact

## Audit Trail
- Every check and uncheck appends a new row to `checklist_run_entries`
- Host can view the full entry history per run (timestamp + who + checked/unchecked)
- Entries are never deleted
