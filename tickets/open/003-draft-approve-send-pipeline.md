---
id: "003"
title: Wire end-to-end draft → approve → send pipeline
status: open
priority: critical
tags: [messaging, pipeline, v1-core, integration]
created: 2026-03-21
assignee: unassigned
---

# Wire end-to-end draft → approve → send pipeline

## Summary

Connect the full message lifecycle: Hospitable webhook receives guest message → intent detection → context assembly → AI draft generation → approval queue → host action → send back via Hospitable API. Currently these pieces exist independently but aren't wired together.

## Context

The individual components exist:
- Hospitable webhook handler (`/api/integrations/hospitable`)
- Message classification (`classify-message.ts`)
- AI draft generation (`generateReplySuggestion()`)
- Knowledge resolution (global + property-scoped)

But there's no orchestration that automatically triggers draft generation when a new guest message arrives, and no send-back mechanism after host approval.

## Requirements

- **Inbound trigger**: when Hospitable webhook delivers a new guest message, automatically run intent detection + context build + draft generation
- **Draft storage**: persist the draft with metadata (intent, sources used, confidence score) linked to the original message
- **Status tracking**: draft lifecycle states — `pending_review` → `approved` / `edited` → `sent` / `rejected`
- **Send mechanism**: after host approves, send the message back through Hospitable API
- **Error handling**: retry logic for failed sends, status feedback to host
- **Audit**: log every state transition with actor, timestamp, before/after payload

## Technical Notes

- Consider whether this needs the outbox pattern (ticket #005) or can start simpler
- The Hospitable API endpoint for sending messages needs to be confirmed/built
- Draft generation should be async (don't block webhook response)

## Acceptance Criteria

- [ ] New guest message automatically triggers draft generation
- [ ] Draft appears in approval queue with intent label and sources
- [ ] Host approves → message sent via Hospitable API
- [ ] Host edits → edited version sent, original and edit both logged
- [ ] Host rejects → draft dismissed, reason optionally captured
- [ ] Full audit trail for every step

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 3 (V1 scope)
- Planning doc: AI_STR_Monorepo_EventDriven_Architecture_v1.pdf — Messaging service v1 scope
