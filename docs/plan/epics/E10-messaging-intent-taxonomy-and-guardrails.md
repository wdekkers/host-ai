# Epic 10: Messaging Intent Taxonomy and Guardrails

**Epic ID:** `E10`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary

This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement

Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives

- Story 10.1: support for v1 intents (booking, rules acknowledgment, arrival/checkout, pool, early/late, spa, sauna)
- Story 10.2: draft-only defaults with explicit high-stakes manual-only categories
- Story 10.3: deterministic template sections driven by structured rules
- Story 10.4: missing required context to trigger clarifying-question drafts

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

- Story 10.1: [Support for v1 intents (booking, rules acknowledgment, arrival/checkout, pool, early/late, spa, sauna)](../stories/E10/S01-support-for-v1-intents-booking-rules-acknowledgment-arrival-chec.md)
- Story 10.2: [Draft-only defaults with explicit high-stakes manual-only categories](../stories/E10/S02-draft-only-defaults-with-explicit-high-stakes-manual-only-catego.md)
- Story 10.3: [Deterministic template sections driven by structured rules](../stories/E10/S03-deterministic-template-sections-driven-by-structured-rules.md)
- Story 10.4: [Missing required context to trigger clarifying-question drafts](../stories/E10/S04-missing-required-context-to-trigger-clarifying-question-drafts.md)

## Release Readiness Checklist

1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
