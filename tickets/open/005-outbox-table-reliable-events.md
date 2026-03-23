---
id: "005"
title: Add outbox table for reliable event delivery between services
status: open
priority: high
tags: [architecture, events, database, reliability]
created: 2026-03-21
assignee: unassigned
---

# Add outbox table for reliable event delivery between services

## Summary

Implement the transactional outbox pattern so events written to the `events` table are reliably delivered to consuming services. Without this, events can be written but never processed.

## Context

The planning docs specify: "Use Postgres as an append-only event log + outbox for the first 6–12 months." The `events` table exists, but there's no `outbox` table to track delivery status, retries, or which services have consumed each event.

## Requirements

- **Outbox table**: `event_id`, `destination` (service name), `status` (pending/delivered/failed), `attempts`, `next_retry_at`, `delivered_at`
- **Writer**: when an event is inserted into `events`, corresponding outbox rows are created for each interested service
- **Poller/worker**: periodically reads pending outbox entries and delivers them (HTTP call to service, or in-process handler)
- **Retry logic**: exponential backoff for failed deliveries, max attempts before dead-letter
- **Cleanup**: archive or delete delivered entries after retention period

## Technical Notes

- Start simple: a cron/interval poller in the gateway or a dedicated worker
- Can evolve to pg_notify or LISTEN/NOTIFY for lower latency
- Keep it Postgres-native to avoid adding message broker infrastructure early

## Acceptance Criteria

- [ ] Outbox table added to `packages/db` schema
- [ ] Events are reliably delivered to subscribing services
- [ ] Failed deliveries are retried with backoff
- [ ] Delivery status is visible for debugging

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 4 (Event backbone)
- Planning doc: AI_STR_Monorepo_EventDriven_Architecture_v1.pdf — outbox table spec
