# Epic 9: Property Brain (Structured Knowledge + RAG)

**Epic ID:** `E09`  
**Status:** Draft  
**Parent Initiative:** AI STR OS Command Center

## Epic Summary

This epic packages a strategic capability area into implementable scope for product, engineering, and operations. It coordinates workflow behavior, data requirements, and control mechanisms so host teams can act quickly without sacrificing trust, safety, or policy compliance.

## Problem Statement

Hospitality operations break down when communication decisions, readiness context, and policy enforcement are fragmented. The result is slower guest response, inconsistent handling, and increased incident/refund exposure. This epic defines a coherent slice of the system that closes those gaps with measurable outcomes.

## Objectives

- Story 9.1: onboarding capture for check-in/out, occupancy, quiet hours, and core house rules
- Story 9.2: explicit early/late policy rules with pricing tiers and boundaries
- Story 9.3: entry, lock, and parking instructions structured
- Story 9.4: cleaner contact preferences and READY/ETA/NOT READY format stored
- Story 9.5: pool heating, spa/hot tub, and sauna policies captured with caveats and safety details
- Story 9.6: amenity importance indexing (critical/important/enhancer)
- Story 9.7: voice profile controls (tone, emoji use, strictness, apology style)
- Story 9.8: an escalation matrix for always-manual scenarios (refunds, threats, injuries, accusations)

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

- Story 9.1: [Onboarding capture for check-in/out, occupancy, quiet hours, and core house rules](../stories/E09/S01-onboarding-capture-for-check-in-out-occupancy-quiet-hours-and-co.md)
- Story 9.2: [Explicit early/late policy rules with pricing tiers and boundaries](../stories/E09/S02-explicit-early-late-policy-rules-with-pricing-tiers-and-boundari.md)
- Story 9.3: [Entry, lock, and parking instructions structured](../stories/E09/S03-entry-lock-and-parking-instructions-structured.md)
- Story 9.4: [Cleaner contact preferences and READY/ETA/NOT READY format stored](../stories/E09/S04-cleaner-contact-preferences-and-ready-eta-not-ready-format-store.md)
- Story 9.5: [Pool heating, spa/hot tub, and sauna policies captured with caveats and safety details](../stories/E09/S05-pool-heating-spa-hot-tub-and-sauna-policies-captured-with-caveat.md)
- Story 9.6: [Amenity importance indexing (critical/important/enhancer)](../stories/E09/S06-amenity-importance-indexing-critical-important-enhancer.md)
- Story 9.7: [Voice profile controls (tone, emoji use, strictness, apology style)](../stories/E09/S07-voice-profile-controls-tone-emoji-use-strictness-apology-style.md)
- Story 9.8: [An escalation matrix for always-manual scenarios (refunds, threats, injuries, accusations)](../stories/E09/S08-an-escalation-matrix-for-always-manual-scenarios-refunds-threats.md)

## Release Readiness Checklist

1. All story acceptance criteria validated.
2. Audit records verified for mutating actions.
3. KPI instrumentation confirmed in dashboards.
4. Internal rollout and support notes documented.
