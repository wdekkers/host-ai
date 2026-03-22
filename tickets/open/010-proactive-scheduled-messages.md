---
id: "010"
title: Implement proactive/scheduled message generation
status: open
priority: medium
tags: [messaging, proactive, automation, v1.5]
created: 2026-03-21
assignee: unassigned
---

# Implement proactive/scheduled message generation

## Summary

Build system-initiated (proactive) messages that the AI generates based on reservation timeline events, not just in response to inbound guest messages. These go to the approval queue for host review before sending.

## Context

V1.5 calls for suggested messages triggered by reservation lifecycle events. Currently, the system only reacts to inbound guest messages — it never initiates outreach.

## Proactive Message Types

1. **Check-in reminder** — sent day-before or morning-of check-in with arrival instructions
2. **First-morning check-in** — sent morning after first night ("everything working?")
3. **Checkout reminder** — sent morning of checkout with checkout steps
4. **Proactive heads-up** — e.g., "pool tech may arrive Tuesday" or weather-related notes

## Requirements

- **Scheduler/cron**: scan upcoming reservations and generate drafts at appropriate times
- **Timing rules**: configurable per property (e.g., check-in reminder 1 day before at 2pm)
- **Deduplication**: don't re-generate if draft already exists for this reservation + intent
- **Queue integration**: proactive drafts appear in approval queue alongside reactive drafts
- **Template-driven**: use templates from ticket #008 with structured property fields

## Technical Notes

- Could use a cron job, Vercel cron, or a poller in the ops service
- Need a `scheduled_messages` or similar table to track what's been generated
- Must handle timezone correctly per property

## Acceptance Criteria

- [ ] Check-in reminder drafts auto-generated for upcoming reservations
- [ ] First-morning check-in drafts generated after first night
- [ ] Checkout instruction drafts generated on checkout morning
- [ ] Proactive drafts appear in the approval queue
- [ ] No duplicate drafts for the same reservation + intent
- [ ] Timing is configurable per property

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 3 (V1.5 scope)
