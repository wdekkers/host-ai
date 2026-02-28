# Epic 5: V2 Operations State Engine and Proactive Incident Drafting

**Epic ID:** `E05`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary
This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement
Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives
- Story 5.1: monitoring agents that emit events for upcoming check-ins, confirmations, vendor windows, and amenity issues
- Story 5.2: a property state engine that computes readiness and blockers
- Story 5.3: immediate host alerts for incidents and a drafted guest reassurance message
- Story 5.4: experience risk scoring (Fix Impact x Guest Sensitivity)

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
- Story 5.1: [Monitoring agents that emit events for upcoming check-ins, confirmations, vendor windows, and amenity issues](../stories/E05/S01-monitoring-agents-that-emit-events-for-upcoming-check-ins-confir.md)
- Story 5.2: [A property state engine that computes readiness and blockers](../stories/E05/S02-a-property-state-engine-that-computes-readiness-and-blockers.md)
- Story 5.3: [Immediate host alerts for incidents and a drafted guest reassurance message](../stories/E05/S03-immediate-host-alerts-for-incidents-and-a-drafted-guest-reassura.md)
- Story 5.4: [Experience risk scoring (Fix Impact x Guest Sensitivity)](../stories/E05/S04-experience-risk-scoring-fix-impact-x-guest-sensitivity.md)

## Release Readiness Checklist
1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
