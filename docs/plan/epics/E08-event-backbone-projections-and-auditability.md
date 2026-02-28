# Epic 8: Event Backbone, Projections, and Auditability

**Epic ID:** `E08`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary
This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement
Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives
- Story 8.1: As platform engineering, we want Postgres-first append-only events plus outbox so we keep complexity low while enabling audit and future event-store migration
- Story 8.2: As backend systems, we want destination-based outbox retries so downstream delivery is reliable
- Story 8.3: As operations users, we want approval queue and property state projections so UI views are fast and task-focused
- Story 8.4: As compliance, we want full audit log before/after payloads by actor so critical decisions are reviewable
- Story 8.5: As data layer, we want normalized properties, guests, reservations, and messages so context retrieval is consistent

## Scope
- Deliver all stories listed under this epic with production-ready acceptance criteria.
- Ensure each story has auditability, dependency awareness, and operational fallback handling.
- Preserve approval-first trust controls where risk and policy require human review.

## Non-Goals
- Cross-epic expansions that are not required for this epic’s outcome.
- Optional enhancements that do not materially improve response quality or risk posture.
- Automation that bypasses manual-only or high-stakes safety guardrails.

## Stakeholders
- Hosts and operations leads using the command center daily.
- Product and engineering teams delivering workflow, state, and reliability.
- Quality/compliance stakeholders requiring traceable decisions.

## Dependencies
- Reliable event ingestion and projection freshness.
- Structured property policy data and retrieval paths.
- Messaging, ops, and notification service contracts.

## Risks and Mitigations
1. **Insufficient context quality** can produce weak recommendations.  
   **Mitigation:** require context completeness checks and clarifying prompts.
2. **Trust erosion from over-automation** can reduce adoption.  
   **Mitigation:** maintain approval-first defaults and visible rationale.
3. **Integration instability** can impact SLA performance.  
   **Mitigation:** retries, outbox patterns, and explicit fallback UX.

## Success Metrics
- Reduced median response time and SLA breaches.
- Improved policy adherence with fewer manual corrections.
- Lower incident escalation and compensation leakage.
- Improved user confidence and command-center-first adoption.

## Stories
- Story 8.1: [As platform engineering, we want Postgres-first append-only events plus outbox so we keep complexity low while enabling audit and future event-store migration](../stories/E08/S01-as-platform-engineering-we-want-postgres-first-append-only-event.md)
- Story 8.2: [As backend systems, we want destination-based outbox retries so downstream delivery is reliable](../stories/E08/S02-as-backend-systems-we-want-destination-based-outbox-retries-so-d.md)
- Story 8.3: [As operations users, we want approval queue and property state projections so UI views are fast and task-focused](../stories/E08/S03-as-operations-users-we-want-approval-queue-and-property-state-pr.md)
- Story 8.4: [As compliance, we want full audit log before/after payloads by actor so critical decisions are reviewable](../stories/E08/S04-as-compliance-we-want-full-audit-log-before-after-payloads-by-ac.md)
- Story 8.5: [As data layer, we want normalized properties, guests, reservations, and messages so context retrieval is consistent](../stories/E08/S05-as-data-layer-we-want-normalized-properties-guests-reservations-.md)

## Release Readiness Checklist
1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
