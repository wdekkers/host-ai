# Agent Config And Shared Knowledge Management (Design)

Date: 2026-03-18
Status: Approved design
Scope: `apps/web`, `packages/db`, `packages/contracts`

## 1. Goal

Create an editable, database-backed configuration and knowledge system for messaging AI that:
- Supports one global agent behavior profile per organization.
- Supports per-property agent behavior overrides.
- Supports shared global Q&A / guidebook content usable by AI, websites, and digital guidebooks.
- Supports property-specific knowledge that overrides global knowledge when needed.
- Removes the need to manage agent behavior or reusable content directly in the database.

## 2. Product Behavior

### Agent behavior
- Global agent config defines default AI behavior for the organization.
- Property agent config stores only property-specific overrides.
- Empty property fields inherit from the global config.
- Typical behavior fields:
  - tone
  - emoji use
  - response length
  - escalation rules
  - special instructions

### Knowledge content
- Knowledge is stored separately from agent behavior.
- Global knowledge applies to all properties by default.
- Property knowledge is attached via actual `propertyId`, not by a fake category convention.
- Property knowledge overrides global knowledge for the same topic.
- Knowledge entries can be used by multiple channels:
  - AI inbox drafting
  - property website
  - digital guidebook

### Publishing behavior
- Global entries can be published to both AI and public-facing channels.
- Property entries can also be published to both AI and public-facing channels.
- Channel visibility is controlled per entry rather than by duplicating content into separate systems.

## 3. Architecture Decision

Use two systems:

1. `agent_configs`
- Stores AI behavior only.
- Keeps the current global + property override pattern.

2. `knowledge_entries`
- New shared content system for reusable Q&A, guidebook, and policy content.
- Replaces the need to model user-managed content separately for inbox AI, website FAQs, and digital guidebooks.

This keeps prompt behavior and reusable content independent. It also allows the same knowledge entry to power multiple product surfaces.

## 4. Data Model

### `agent_configs`

Keep the current model:
- one `global` row per organization
- optional one `property` row per property

Fields:
- `id`
- `organizationId`
- `scope` (`global` | `property`)
- `propertyId` (nullable for global)
- `tone`
- `emojiUse`
- `responseLength`
- `escalationRules`
- `specialInstructions`
- `createdAt`
- `updatedAt`

### `knowledge_entries`

Create a shared table for managed knowledge.

Fields:
- `id`
- `organizationId`
- `scope` (`global` | `property`)
- `propertyId` (nullable for global, required for property entries)
- `entryType` (`faq` | `guidebook` | `policy` | `amenity` | `checkin` | `checkout`)
- `topicKey` (stable dedupe / override key)
- `title`
- `question`
- `answer`
- `body`
- `channels` (array of `ai`, `website`, `guidebook`)
- `status` (`draft` | `published` | `archived`)
- `sortOrder`
- `slug` (optional, for public rendering)
- `createdAt`
- `updatedAt`

Notes:
- `question` + `answer` work well for FAQ entries.
- `title` + `body` work well for guidebook or policy entries.
- Not every field is required for every `entryType`; contracts should validate allowed combinations.

## 5. Inheritance And Override Rules

### Agent config merge
1. Load organization global config.
2. If a property config exists, overlay non-empty property fields.
3. Use merged output for AI draft generation.

### Knowledge merge
1. Load published global entries for the requested channel.
2. Load published property entries for the same channel and property.
3. Merge by `topicKey`.
4. If both exist, property entry overrides global entry.

This precedence rule must be used consistently by:
- AI prompt assembly
- website FAQ rendering
- digital guidebook rendering

## 6. UI Structure

### Global pages

#### `/settings/agent`
- Edit global AI behavior defaults.
- Save to global `agent_configs` row.

#### `/settings/knowledge`
- Manage global knowledge entries.
- Filters:
  - entry type
  - channel
  - status

### Property pages

#### `/properties/[id]/agent`
- Edit property-specific behavior overrides.
- Show inherited global values next to each field.
- Empty field means inherit from global.

#### `/properties/[id]/knowledge`
- Manage property-specific knowledge entries.
- Show inherited global entries in a separate read-only panel or comparison state.
- Allow a user to create a property override from a global entry.

### UI grouping

Although the underlying data model is shared, management should be separated in the UI:
- FAQ tab
- Guidebook tab
- optional Policies tab later

This keeps editing simpler without forcing separate storage models.

## 7. Override UX

- Global entries should have a stable `topicKey`.
- A property page can offer an `Override` action on a global entry.
- Override flow clones the entry into a property-scoped draft for that property.
- Once published, the property entry replaces the global entry for that property everywhere.

Example:
- Global FAQ: `parking`
- Property-specific FAQ: `parking`
- Property-specific row wins for that property in AI, website, and guidebook contexts.

## 8. Current-State Migration

### Keep
- Existing `agent_configs` table and API routes.

### Introduce
- New `knowledge_entries` table and CRUD routes.

### Migrate
- Existing FAQ content into `knowledge_entries` with `entryType = faq`.
- Existing guidebook content into `knowledge_entries` with `entryType = guidebook`.

### Defer
- Keep `property_memory` separate for now if it remains AI-generated internal memory rather than human-managed content.
- Later, allow approved memory items to be promoted into managed `knowledge_entries`.

## 9. API Surface

### Agent config
- `GET /api/agent-config`
- `PUT /api/agent-config`
- `GET /api/properties/:id/agent-config`
- `PUT /api/properties/:id/agent-config`

### Knowledge
- `GET /api/knowledge?scope=global`
- `POST /api/knowledge`
- `PATCH /api/knowledge/:id`
- `GET /api/properties/:id/knowledge`
- `POST /api/properties/:id/knowledge`
- `POST /api/properties/:id/knowledge/:entryId/override`

Exact route names can be adjusted during implementation, but the separation between global and property-managed content should remain explicit.

## 10. Implementation Order

1. Add `knowledge_entries` schema and contracts.
2. Add global and property CRUD APIs for knowledge management.
3. Build `/settings/agent`.
4. Build `/settings/knowledge`.
5. Build `/properties/[id]/agent`.
6. Build `/properties/[id]/knowledge`.
7. Update AI prompt assembly to use shared knowledge resolution with property override precedence.
8. Update website and guidebook consumers to use the same resolver.
9. Add migration/backfill for existing FAQ and guidebook content.

## 11. Out Of Scope (Initial Pass)

- Full taxonomy optimization beyond initial `entryType` values.
- Public website rendering redesign.
- Digital guidebook visual redesign.
- Automatic conversion of learned memory into published knowledge without human review.

## 12. Implementation Readiness

Design is validated and ready for implementation planning.
Recommended next step: create an implementation plan covering DB, API, global settings UI, property settings UI, resolver logic, and migration work.
