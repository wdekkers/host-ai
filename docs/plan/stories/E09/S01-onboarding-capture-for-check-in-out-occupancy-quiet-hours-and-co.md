# Story 9.1: Onboarding capture for check-in/out, occupancy, quiet hours, and core house rules

**Epic:** [Epic 9: Property Brain (Structured Knowledge + RAG)](../../epics/E09-property-brain-structured-knowledge-rag.md)  
**Story ID:** `E09-S01`  
**Status:** Draft  
**Primary Actor:** a host

## User Story
As a host, I want onboarding capture for check-in/out, occupancy, quiet hours, and core house rules so policy responses are deterministic.

## Story Intent
This story exists to deliver a concrete capability in the AI STR OS command center: onboarding capture for check-in/out, occupancy, quiet hours, and core house rules. The expected business impact is that policy responses are deterministic.

## Business Value
- Improves operational consistency for host-facing communication and decisions.
- Reduces avoidable delays, manual effort, and policy drift in day-to-day workflows.
- Increases traceability and confidence through visible context and auditable actions.

## Functional Requirements
1. The end-to-end flow for this story must be available in the command-center workflow used by hosts/operators.
2. Inputs needed to execute this story must be validated before action to prevent low-confidence outcomes.
3. Outputs generated for this story must include enough context for human verification when approval is required.
4. All mutating actions in this story must create audit records with actor, timestamp, and before/after state.
5. Error states in this story must produce actionable fallback behavior, not silent failures.

## Acceptance Criteria
1. Given all required inputs are present, when the actor executes this story flow, then the expected result is produced successfully.
2. Given policy constraints apply, when the system computes or drafts an output, then the output reflects property-specific rules.
3. Given host review is required, when a draft or recommendation is presented, then the user can preview, edit, and approve or reject.
4. Given required context is missing, when the flow is triggered, then the system blocks unsafe execution and requests clarification.
5. Given a dependency fails, when the flow cannot complete, then the system surfaces retry/recovery guidance and logs the failure.

## Dependencies
- Property profile and policy completeness for relevant fields.
- Fresh event/projection state for messages, reservations, and operational context.
- Service interoperability across messaging, ops, notifications, and audit layers.

## Data and Telemetry
- Measure flow volume, latency, completion rate, and exception rate for this story.
- Measure host interactions (approve/edit/reject) to identify quality gaps.
- Correlate this story with outcome metrics (response speed, incident rate, refunds, review signals).

## Out of Scope
- Full autonomous actions in categories marked high-stakes or manual-only.
- Expanding this flow beyond the defined roadmap phase without validation.

## Definition of Done
1. Behavior is implemented with validation and fallback handling.
2. Acceptance criteria are testable and verified.
3. Audit and telemetry signals are queryable in dashboards/logs.
4. Runbook notes exist for support and phased rollout.
