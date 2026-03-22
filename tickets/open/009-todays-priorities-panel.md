---
id: "009"
title: Build "Today's Priorities" problems-first panel
status: open
priority: medium
tags: [ui, ops, command-center, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Build "Today's Priorities" problems-first panel

## Summary

Add a "Today's Priorities" panel below the approval queue that surfaces only problems and risks: turnovers at risk, vendor conflicts, escalations, and overdue items. This is the operations awareness layer of V1.

## Context

The plan says: "Problems-first 'Today's Priorities' panel beneath approval queue: turns over at risk, vendor conflicts, escalations." The current `/today` page exists but may not be structured as a problems-first view.

## Requirements

- **Turnovers at risk**: same-day checkout → check-in with no cleaner confirmation
- **Vendor conflicts**: overlapping vendor windows, missing confirmations
- **Escalations**: messages flagged for human review, high-risk guests
- **Overdue tasks**: tasks past their due date
- **SLA breaches**: guest messages unanswered beyond threshold (e.g., 1 hour)
- Each item should be actionable: click through to the relevant detail (reservation, message, task)
- Panel should be below the approval queue on the landing page

## Acceptance Criteria

- [ ] Today's Priorities panel renders below the approval queue
- [ ] Shows only problems/risks (not a general status dashboard)
- [ ] Items are actionable with drill-down links
- [ ] Auto-refreshes or updates in near-real-time

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 9 (UX: Today's Priorities)
