# Epic 7: Monorepo and Service Architecture

**Epic ID:** `E07`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary

This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement

Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives

- Story 7.1: As engineering, we want a monorepo with `apps/web`, `apps/gateway`, domain services, shared packages, and infra so delivery stays consistent and modular
- Story 7.2: As frontend users, we want a Next.js dashboard focused on approval queue, priorities, and property overview so communication remains the primary workflow
- Story 7.3: As backend engineering, we want a gateway/BFF for auth, routing, and rate limiting so service access is consistent and secure
- Story 7.4: As platform engineering, we want dedicated identity, messaging, ops, and notification services so concerns are separated and scalable
- Story 7.5: As developers, we want shared contracts, DB tooling, AI utilities, and UI packages so cross-service changes remain type-safe and fast

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

- Story 7.1: [As engineering, we want a monorepo with `apps/web`, `apps/gateway`, domain services, shared packages, and infra so delivery stays consistent and modular](../stories/E07/S01-as-engineering-we-want-a-monorepo-with-apps-web-apps-gateway-dom.md)
- Story 7.2: [As frontend users, we want a Next.js dashboard focused on approval queue, priorities, and property overview so communication remains the primary workflow](../stories/E07/S02-as-frontend-users-we-want-a-next-js-dashboard-focused-on-approva.md)
- Story 7.3: [As backend engineering, we want a gateway/BFF for auth, routing, and rate limiting so service access is consistent and secure](../stories/E07/S03-as-backend-engineering-we-want-a-gateway-bff-for-auth-routing-an.md)
- Story 7.4: [As platform engineering, we want dedicated identity, messaging, ops, and notification services so concerns are separated and scalable](../stories/E07/S04-as-platform-engineering-we-want-dedicated-identity-messaging-ops.md)
- Story 7.5: [As developers, we want shared contracts, DB tooling, AI utilities, and UI packages so cross-service changes remain type-safe and fast](../stories/E07/S05-as-developers-we-want-shared-contracts-db-tooling-ai-utilities-a.md)

## Release Readiness Checklist

1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
