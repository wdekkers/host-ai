# Epic 13: Command Center UX and Workflow

**Epic ID:** `E13`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary
This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement
Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives
- Story 13.1: Approval Queue as the default landing screen
- Story 13.2: urgency/SLA-based sorting with quick Preview/Edit/Send actions
- Story 13.3: conversation detail with sources, policy references, intent labels, and risk/trust badges
- Story 13.4: Today’s Priorities beneath queue and drill-downs to property/reservation details
- Story 13.5: minimal property overview with readiness snapshot and blockers

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
- Story 13.1: [Approval Queue as the default landing screen](../stories/E13/S01-approval-queue-as-the-default-landing-screen.md)
- Story 13.2: [Urgency/SLA-based sorting with quick Preview/Edit/Send actions](../stories/E13/S02-urgency-sla-based-sorting-with-quick-preview-edit-send-actions.md)
- Story 13.3: [Conversation detail with sources, policy references, intent labels, and risk/trust badges](../stories/E13/S03-conversation-detail-with-sources-policy-references-intent-labels.md)
- Story 13.4: [Today’s Priorities beneath queue and drill-downs to property/reservation details](../stories/E13/S04-today-s-priorities-beneath-queue-and-drill-downs-to-property-res.md)
- Story 13.5: [Minimal property overview with readiness snapshot and blockers](../stories/E13/S05-minimal-property-overview-with-readiness-snapshot-and-blockers.md)

## Release Readiness Checklist
1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
