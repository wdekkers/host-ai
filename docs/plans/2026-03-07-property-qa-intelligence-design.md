# Property Q&A Intelligence with Review Queue (Design)

Date: 2026-03-07
Status: Approved design
Scope: `apps/web`, `apps/gateway`, `services/messaging` (or equivalent ingestion path), `packages/contracts`, `packages/db`

## 1. Goal

Create a property-scoped Q&A system that:
- Analyzes inbound inbox conversations automatically.
- Proposes reusable Q&A entries when messages are likely recurring guest questions.
- Routes proposals to a human review queue.
- Makes approved entries immediately available to future draft generation.
- Supports manual Q&A management per property for newly introduced amenities/policies.

## 2. Product Behavior

### Inbound analysis flow
1. Inbound guest message is ingested and persisted (existing inbox pipeline).
2. Q&A analyzer runs automatically for the message.
3. If message is likely reusable as Q&A, create a `pending` suggestion for that `propertyId`.
4. Questions page shows pending suggestions and a top-level notification/count for newly ready items.

### Review flow (Questions page)
- Reviewer sees proposed question, proposed answer, confidence, and linked source message.
- Reviewer actions:
  - Approve
  - Edit + Approve
  - Reject
- Approval creates/activates property Q&A entry immediately.

### Scope decisions
- Auto-generation: enabled.
- Review location: Questions page + top notifications for new review items.
- Scope: property-only Q&A (no global layer in v1).
- Publish model: approval required; approved entries become immediately usable by AI.

## 3. Approach Decision

Selected approach: **Option B (LLM-first)**.

Rationale:
- Highest quality and coverage for natural-language guest questions.
- Faster to reach high-value output quality than rule-first systems.
- Cost is acceptable at current expected volume.
- Human approval gate remains mandatory, which controls risk.

Operational constraints:
- No auto-publish of model output.
- Reviewer feedback (`edit_then_approve`, `reject`) is captured for quality tuning.

## 4. Data Model

## `property_qa_entries`
- `id` (pk)
- `property_id` (indexed)
- `question`
- `answer`
- `status` (`active` | `archived`)
- `source` (`manual` | `suggestion`)
- `created_by`
- `updated_by`
- `created_at`, `updated_at`

## `property_qa_suggestions`
- `id` (pk)
- `property_id` (indexed)
- `source_message_id` (indexed)
- `proposed_question`
- `proposed_answer`
- `classifier_label` (`likely-reusable` | `one-off` | `unclear`)
- `confidence` (0..1)
- `status` (`pending` | `approved` | `rejected` | `invalid_output`)
- `reviewed_by` (nullable)
- `reviewed_at` (nullable)
- `created_at`, `updated_at`

## `property_qa_suggestion_events` (recommended)
- `id` (pk)
- `suggestion_id` (fk)
- `event_type` (`created` | `approved` | `edited_approved` | `rejected` | `archived`)
- `actor_id`
- `payload` (json)
- `created_at`

## 5. API Surface (Command Center namespace)

### Q&A entries
- `GET /api/command-center/qa/:propertyId`
- `POST /api/command-center/qa/:propertyId`
- `PATCH /api/command-center/qa/entry/:id`

### Suggestions
- `GET /api/command-center/qa-suggestions/:propertyId?status=pending`
- `POST /api/command-center/qa-suggestions/:id/approve`
- `POST /api/command-center/qa-suggestions/:id/reject`
- `GET /api/command-center/qa-suggestions/notifications`

Response payloads should include source trace fields (`sourceMessageId`, `confidence`, `classifierLabel`) for reviewer trust.

## 6. Draft Generation Integration

When creating AI drafts for a message:
1. Assemble normal property policy context first (authoritative).
2. Add relevant `active` property Q&A entries as secondary context.
3. Prefer deterministic policy fields over Q&A if conflicts occur.

This keeps policy-compliance primary while improving answer speed/consistency for recurring questions.

## 7. Quality Controls

- Ground model answers in approved sources only:
  - property policy fields
  - approved property Q&A
  - reservation/context objects
- If context is insufficient, return `needs_more_context` and do not fabricate an answer.
- Show confidence + source link in reviewer UI.
- Capture reviewer outcomes and edits as training signals.

## 8. Error Handling

- Analyzer failure must be non-blocking to inbox ingestion.
- Schema/validation failure on model output => mark as `invalid_output`, hide from review queue.
- Deduplicate near-identical suggestions per property using normalized-question hash.
- Auto-archive stale pending suggestions after retention window (default 30 days, configurable).

## 9. Testing Strategy

### Unit
- Suggestion eligibility and labeling.
- Deduplication hash behavior.
- Status transitions: `pending -> approved/rejected`.

### Integration
- Inbound message -> suggestion creation.
- Suggestion approve/reject APIs.
- Approved Q&A presence in context assembly for draft generation.

### UI
- Questions page notification/count for new suggestions.
- Review queue render and actions.
- Manual property Q&A add/edit/archive flows.

## 10. Metrics and Observability

Track at minimum:
- Suggestions created per day/property.
- Approval, edit-approve, rejection rates.
- Median time-to-review.
- Duplicate suppression rate.
- Invalid output rate.
- Draft quality impact proxy (edit distance or host-edit rate on intents covered by approved Q&A).

## 11. Out of Scope (v1)

- Global/shared Q&A library across properties.
- Fully automated publishing without human review.
- Cross-property answer inheritance.

## 12. Implementation Readiness

Design is validated and ready for implementation planning.
Recommended next step: create an implementation plan with phased tickets (DB/contracts/API/UI/observability/tests) and execute in an isolated worktree.
