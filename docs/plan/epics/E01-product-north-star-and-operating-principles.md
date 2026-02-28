# Epic 1: Product North Star and Operating Principles

**Epic ID:** `E01`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary
This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement
Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives
- Story 1.1: a control-tower dashboard that shows what matters today
- Story 1.2: AI to draft responses with visible context and sources
- Story 1.3: approval/edit/send as the default flow
- Story 1.4: structured policy fields to be the authoritative source
- Story 1.5: event-driven state updates instead of manual checklists
- Story 1.6: globally portable guest trust and locally configurable risk tolerance
- Story 1.7: a recovery state machine for incidents
- Story 1.8: local-first decisions with portfolio-informed insights

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
- Story 1.1: [A control-tower dashboard that shows what matters today](../stories/E01/S01-a-control-tower-dashboard-that-shows-what-matters-today.md)
- Story 1.2: [AI to draft responses with visible context and sources](../stories/E01/S02-ai-to-draft-responses-with-visible-context-and-sources.md)
- Story 1.3: [Approval/edit/send as the default flow](../stories/E01/S03-approval-edit-send-as-the-default-flow.md)
- Story 1.4: [Structured policy fields to be the authoritative source](../stories/E01/S04-structured-policy-fields-to-be-the-authoritative-source.md)
- Story 1.5: [Event-driven state updates instead of manual checklists](../stories/E01/S05-event-driven-state-updates-instead-of-manual-checklists.md)
- Story 1.6: [Globally portable guest trust and locally configurable risk tolerance](../stories/E01/S06-globally-portable-guest-trust-and-locally-configurable-risk-tole.md)
- Story 1.7: [A recovery state machine for incidents](../stories/E01/S07-a-recovery-state-machine-for-incidents.md)
- Story 1.8: [Local-first decisions with portfolio-informed insights](../stories/E01/S08-local-first-decisions-with-portfolio-informed-insights.md)

## Release Readiness Checklist
1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
