# Epic 11: Guest Risk and Trust Intelligence

**Epic ID:** `E11`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary
This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement
Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives
- Story 11.1: a transparent risk/trust model that explains factors and recommendations
- Story 11.2: booking pattern signals, profile quality signals, language cues, and policy-violation flags
- Story 11.3: As trust analysis, I want positive review history, response quality, and explicit rule acceptance to boost confidence scoring
- Story 11.4: Host Operating Profile tuning (strictness, generosity, compensation, economic sensitivity)

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
- Story 11.1: [A transparent risk/trust model that explains factors and recommendations](../stories/E11/S01-a-transparent-risk-trust-model-that-explains-factors-and-recomme.md)
- Story 11.2: [Booking pattern signals, profile quality signals, language cues, and policy-violation flags](../stories/E11/S02-booking-pattern-signals-profile-quality-signals-language-cues-an.md)
- Story 11.3: [As trust analysis, I want positive review history, response quality, and explicit rule acceptance to boost confidence scoring](../stories/E11/S03-as-trust-analysis-i-want-positive-review-history-response-qualit.md)
- Story 11.4: [Host Operating Profile tuning (strictness, generosity, compensation, economic sensitivity)](../stories/E11/S04-host-operating-profile-tuning-strictness-generosity-compensation.md)

## Release Readiness Checklist
1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
