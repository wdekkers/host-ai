# Epic 3: V1 Reactive Communication Command Center

**Epic ID:** `E03`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary

This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement

Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives

- Story 3.1: to ingest guest messages from Hospitable webhooks
- Story 3.2: intent detection for key hospitality intents
- Story 3.3: per-property context assembly from policies, docs (RAG), and reservation context
- Story 3.4: each draft to display source references
- Story 3.5: an approval queue with Preview/Edit/Send
- Story 3.6: full audit logs for draft/edit/send actions
- Story 3.7: visible risk/trust indicators on booking requests and inquiries

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

- Story 3.1: [Ingest guest messages from Hospitable webhooks](../stories/E03/S01-ingest-guest-messages-from-hospitable-webhooks.md)
- Story 3.2: [Intent detection for key hospitality intents](../stories/E03/S02-intent-detection-for-key-hospitality-intents.md)
- Story 3.3: [Per-property context assembly from policies, docs (RAG), and reservation context](../stories/E03/S03-per-property-context-assembly-from-policies-docs-rag-and-reserva.md)
- Story 3.4: [Each draft to display source references](../stories/E03/S04-each-draft-to-display-source-references.md)
- Story 3.5: [An approval queue with Preview/Edit/Send](../stories/E03/S05-an-approval-queue-with-preview-edit-send.md)
- Story 3.6: [Full audit logs for draft/edit/send actions](../stories/E03/S06-full-audit-logs-for-draft-edit-send-actions.md)
- Story 3.7: [Visible risk/trust indicators on booking requests and inquiries](../stories/E03/S07-visible-risk-trust-indicators-on-booking-requests-and-inquiries.md)

## Release Readiness Checklist

1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
