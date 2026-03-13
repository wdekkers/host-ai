# Tasks Service Design

**Date:** 2026-03-13
**Status:** Approved
**Branch:** feat/contact-center-vendors-checklists-v2

## Overview

A generic `services/tasks` microservice for managing property-level planned tasks. Supports multi-property assignment, priority levels, categories, staff assignment, full CRUD with soft deletes, and a complete audit trail. Designed as a platform-grade service that can expand to cover turnover checklists, maintenance requests, and other task-like concepts without needing a separate service.

## Goals

- Allow property managers and staff to create, assign, and resolve tasks across one or more properties
- Filter tasks by property, priority, category, status, and assignee
- Maintain an immutable audit trail of all mutations
- Mobile-first UI accessible from a global `/tasks` page and from each property's detail page
- Built as a standalone microservice for long-term SaaS extensibility

## Non-Goals

- No reservation linkage (planned for a future turnover/turnaround feature)
- No push notifications in this iteration
- No recurring tasks in this iteration

---

## Data Model

### `task_categories`

| Column         | Type      | Notes                             |
| -------------- | --------- | --------------------------------- |
| id             | uuid      | PK                                |
| organizationId | uuid      | Org-scoped                        |
| name           | text      | e.g. "House", "Digital", "Garden" |
| color          | text      | Optional hex/token                |
| deletedAt      | timestamp | Soft delete                       |
| createdAt      | timestamp |                                   |
| createdBy      | text      | userId                            |

### `tasks`

| Column         | Type      | Notes                             |
| -------------- | --------- | --------------------------------- |
| id             | uuid      | PK                                |
| organizationId | uuid      | Org-scoped                        |
| title          | text      | Required                          |
| description    | text      | Optional                          |
| status         | enum      | `open` \| `resolved` \| `deleted` |
| priority       | enum      | `low` \| `medium` \| `high`       |
| categoryId     | uuid      | FK → task_categories, nullable    |
| assigneeId     | text      | userId, nullable                  |
| propertyIds    | uuid[]    | One or more property IDs          |
| dueDate        | date      | Optional                          |
| resolvedAt     | timestamp | Set on resolve                    |
| resolvedBy     | text      | userId                            |
| deletedAt      | timestamp | Soft delete                       |
| deletedBy      | text      | userId                            |
| createdAt      | timestamp |                                   |
| createdBy      | text      | userId                            |
| updatedAt      | timestamp |                                   |
| updatedBy      | text      | userId                            |

**Priority colors:**

- `low` → yellow
- `medium` → orange
- `high` → red

### `task_audit_events`

| Column         | Type      | Notes                                                                                 |
| -------------- | --------- | ------------------------------------------------------------------------------------- |
| id             | uuid      | PK                                                                                    |
| taskId         | uuid      | FK → tasks                                                                            |
| organizationId | uuid      | Org-scoped                                                                            |
| action         | enum      | `created` \| `updated` \| `resolved` \| `restored` \| `deleted` \| `category_deleted` |
| changedBy      | text      | userId                                                                                |
| changedAt      | timestamp |                                                                                       |
| delta          | jsonb     | Before/after snapshot of changed fields                                               |

---

## Service Architecture

**Service:** `services/tasks`
**Pattern:** Fastify microservice, same structure as `services/messaging`
**Contracts:** `packages/contracts/src/tasks.ts` (Zod schemas, shared with web app)
**Gateway registration:** `/api/tasks` prefix forwarded to tasks service

### API Endpoints

#### Tasks

| Method | Path               | Description                                                                                           |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------- |
| GET    | /tasks             | List tasks. Filters: `propertyId`, `status`, `priority`, `categoryId`, `assigneeId`, `includeDeleted` |
| POST   | /tasks             | Create task                                                                                           |
| GET    | /tasks/:id         | Get single task                                                                                       |
| PATCH  | /tasks/:id         | Update task fields                                                                                    |
| POST   | /tasks/:id/resolve | Mark resolved (sets `resolvedAt`, `resolvedBy`)                                                       |
| DELETE | /tasks/:id         | Soft delete (sets `deletedAt`, `deletedBy`)                                                           |

#### Task Categories

| Method | Path                 | Description          |
| ------ | -------------------- | -------------------- |
| GET    | /task-categories     | List org categories  |
| POST   | /task-categories     | Create category      |
| PATCH  | /task-categories/:id | Update category      |
| DELETE | /task-categories/:id | Soft delete category |

All routes are org-scoped via `organizationId` from auth context. Auth validation happens at the gateway layer before forwarding.

---

## Contracts (`packages/contracts/src/tasks.ts`)

```typescript
TaskPriority = 'low' | 'medium' | 'high'
TaskStatus = 'open' | 'resolved' | 'deleted'
TaskAuditAction = 'created' | 'updated' | 'resolved' | 'restored' | 'deleted' | 'category_deleted'

Task {
  id, organizationId, title, description?, status, priority,
  categoryId?, assigneeId?, propertyIds, dueDate?,
  resolvedAt?, resolvedBy?, deletedAt?, deletedBy?,
  createdAt, createdBy, updatedAt, updatedBy
}

TaskCategory {
  id, organizationId, name, color?, deletedAt?, createdAt, createdBy
}

TaskAuditEvent {
  id, taskId, organizationId, action, changedBy, changedAt, delta
}

CreateTaskInput { title, description?, priority, categoryId?, assigneeId?, propertyIds, dueDate? }
UpdateTaskInput { title?, description?, priority?, categoryId?, assigneeId?, propertyIds?, dueDate? }
CreateTaskCategoryInput { name, color? }
```

---

## Audit Trail

Every mutation writes a `task_audit_events` record with a `delta` jsonb snapshot:

- `created` — full initial field snapshot
- `updated` — only changed fields: `{ priority: { from: 'low', to: 'high' } }`
- `resolved` — `{ resolvedAt, resolvedBy }`
- `restored` — when a resolved task is re-opened
- `deleted` — `{ deletedAt, deletedBy }`
- `category_deleted` — written to all tasks referencing the deleted category

Soft-deleted tasks are excluded from default queries. Pass `?includeDeleted=true` for admin/audit access. Deleted categories are retained and shown as "Archived category" on tasks that still reference them.

---

## UI Design

### Global `/tasks` Page (main nav)

- **Mobile:** Stacked card list with priority color left border, filter sheet accessible from top bar
- **Desktop:** List/table view with inline filter bar (property, priority, category, status, assignee)
- "New Task" button opens a slide-over/modal form
- Resolved tasks shown in a collapsible "Resolved" section below open tasks
- "Manage Categories" button opens a category management modal

### Property Detail Page — Tasks Tab

- Same card list, pre-filtered to that property
- No property filter needed (already scoped)
- "New Task" button pre-fills the property

### Task Card

- Priority color left border (yellow / orange / red)
- Title, category badge, assignee avatar, due date
- Tap/click opens a detail/edit slide-over
- Mobile swipe actions: resolve, delete

### Task Form (Create/Edit)

- Title (required), description (optional, multiline)
- Priority selector — colored chips (Low / Medium / High)
- Category selector with "Manage Categories" link
- Property multi-select (searchable)
- Assignee picker (org members)
- Due date picker (optional)

### Resolved View

- Resolved tasks greyed out, showing resolved date and resolver
- Can be re-opened (restores to `open`, writes `restored` audit event)

### Category Management Modal

- List existing categories with edit/delete per row
- Inline "Add category" form (name + optional color)
- Soft-deleted categories hidden from list but retained in DB

---

## Mobile-First Requirements

All views must be fully functional and usable on mobile devices:

- Touch targets minimum 44px
- Slide-overs instead of modals on small screens
- Filter controls accessible via bottom sheet or top bar
- Card layout (not table) on mobile breakpoints
- Swipe gestures for quick actions on task cards

---

## Navigation Changes

- Add "Tasks" to main nav (`/tasks`) in `apps/web/src/lib/nav-links.ts`
- Add "Tasks" tab to property detail page (`/properties/[id]`)

---

## Open Questions / Future Work

- Recurring tasks (not in scope)
- Push/email notifications when assigned (not in scope)
- Turnover/reservation-linked tasks — to be addressed in a separate turnaround feature
- Task templates (not in scope)
