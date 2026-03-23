---
id: "004"
title: Define event contracts in packages/contracts
status: open
priority: high
tags: [architecture, events, contracts, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Define event contracts in packages/contracts

## Summary

Create typed event contracts (Zod schemas) in `packages/contracts` for the core domain events. The `events` table exists but there are no defined event types or payload schemas, making the event system unstructured.

## Context

The planning docs specify these minimal event contracts to start:
- `GuestMessageReceived`
- `MessageDrafted`
- `DraftApproved` / `DraftEdited` / `DraftRejected`
- `MessageSent`
- `EarlyCheckInRequested`
- `CleanerPingSent`
- `CleanerStatusUpdated` (READY / ETA / NOT_READY)
- `PropertyStateUpdated`
- `TurnoverAtRiskDetected`

Currently `packages/contracts` has Zod schemas for service-level validation but no domain event definitions.

## Requirements

- Define Zod schemas for each event type with typed payloads
- Export a union/discriminated type for all events
- Include metadata fields: `eventId`, `eventType`, `accountId`, `propertyId`, `aggregateId`, `occurredAt`
- Payload schemas should be strict (no arbitrary jsonb)
- Add helper functions for creating events with proper typing

## Acceptance Criteria

- [ ] All V1 event types defined with Zod schemas in `packages/contracts`
- [ ] Event payloads are fully typed (no `unknown` or `any`)
- [ ] Shared event metadata type (id, type, account, property, timestamp)
- [ ] Events can be validated at service boundaries
- [ ] Existing `events` table inserts use these schemas

## References

- Planning doc: AI_STR_Monorepo_EventDriven_Architecture_v1.pdf — Minimal event contracts
