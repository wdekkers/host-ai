---
id: "012"
title: Build property state engine (readiness as computed state)
status: open
priority: medium
tags: [ops, database, state-engine, v2]
created: 2026-03-21
assignee: unassigned
---

# Build property state engine (readiness as computed state)

## Summary

Model property readiness as a computed state that considers cleaning status, vendor conflicts, maintenance blockers, and critical amenity health. "Clean ≠ Ready" — readiness is a projection, not a single flag.

## Context

The plan emphasizes: "Model 'Ready' as a computed state. Readiness includes cleaning, vendor conflicts, maintenance blockers, and critical amenity health." This is a core V2 concept but foundations should be laid early.

## Requirements

- **`property_state` projection table**: `property_id`, `readiness_status` (enum: ready/not_ready/at_risk/unknown), `blockers` (jsonb array), `eta_ready` (timestamp), `last_updated`
- **Blocker types**: cleaning_pending, vendor_conflict, maintenance_required, amenity_offline, no_cleaner_assigned
- **Compute logic**: aggregate signals from tasks, checklists, vendor schedules, and amenity status
- **Update triggers**: recalculate when relevant events occur (task completed, cleaner confirms, etc.)
- **Dashboard**: property overview shows readiness state and active blockers

## Technical Notes

- Start as a simple projection updated on relevant events
- Can evolve into a continuous monitoring agent (V2 scope)
- Integrate with Today's Priorities (ticket #009) — "at_risk" properties surface there

## Acceptance Criteria

- [ ] `property_state` table in schema
- [ ] Readiness computed from cleaning + vendor + maintenance + amenity signals
- [ ] Blockers array shows what's preventing readiness
- [ ] Property overview UI shows current readiness state
- [ ] At-risk properties surface in Today's Priorities

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 8 (Operations Awareness)
