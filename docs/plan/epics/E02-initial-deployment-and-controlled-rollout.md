# Epic 2: Initial Deployment and Controlled Rollout

**Epic ID:** `E02`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary
This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement
Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives
- Story 2.1: As the internal team, we want to deploy first across 3 STR + 1 MTR properties so we can validate reliability before external launch
- Story 2.2: As product leadership, we want host-by-host onboarding after internal validation so risk is controlled during scale-up
- Story 2.3: As the AI team, we want to capture host edits as training signals so response quality improves with real usage
- Story 2.4: As leadership, we want internal ROI tracking on response speed, incidents, refunds, and reviews so go/no-go scaling decisions are data-driven

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
- Story 2.1: [As the internal team, we want to deploy first across 3 STR + 1 MTR properties so we can validate reliability before external launch](../stories/E02/S01-as-the-internal-team-we-want-to-deploy-first-across-3-str-1-mtr-.md)
- Story 2.2: [As product leadership, we want host-by-host onboarding after internal validation so risk is controlled during scale-up](../stories/E02/S02-as-product-leadership-we-want-host-by-host-onboarding-after-inte.md)
- Story 2.3: [As the AI team, we want to capture host edits as training signals so response quality improves with real usage](../stories/E02/S03-as-the-ai-team-we-want-to-capture-host-edits-as-training-signals.md)
- Story 2.4: [As leadership, we want internal ROI tracking on response speed, incidents, refunds, and reviews so go/no-go scaling decisions are data-driven](../stories/E02/S04-as-leadership-we-want-internal-roi-tracking-on-response-speed-in.md)

## Release Readiness Checklist
1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
