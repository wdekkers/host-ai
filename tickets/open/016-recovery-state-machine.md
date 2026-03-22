---
id: "016"
title: Implement incident recovery state machine
status: open
priority: low
tags: [ops, incidents, state-machine, v2]
created: 2026-03-21
assignee: unassigned
---

# Implement incident recovery state machine

## Summary

Model incident recovery as a state machine so the system tracks resolution progress and prevents re-litigation after compensation is accepted.

## Context

The plan defines: "Recovery is a state machine: after compensation is accepted, close the loop and normalize; do not re-litigate." This prevents the common failure mode where a resolved issue keeps getting brought up.

## State Machine

```
Incident Active → Negotiation → Resolution Accepted → Recovery Closed → Normalized
```

## Requirements

- **Incident tracking**: create an incident when a guest issue is detected (from message classification or host-flagged)
- **State transitions**: each transition logged with actor, timestamp, and context
- **Compensation tracking**: what was offered, what was accepted, final amount
- **Normalization**: after recovery closed, subsequent messages about the same issue should reference the resolution, not re-open
- **Dashboard**: active incidents visible in Today's Priorities, resolved incidents in audit trail

## Acceptance Criteria

- [ ] Incident model with state machine in the schema
- [ ] State transitions enforced (can't skip steps)
- [ ] Compensation linked to incident
- [ ] Normalized state prevents re-litigation in AI drafts
- [ ] Incidents visible in Today's Priorities and audit trail

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 8 (Recovery state machine)
