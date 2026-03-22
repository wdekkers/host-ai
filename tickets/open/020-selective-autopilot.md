---
id: "020"
title: Implement selective autopilot for safe intents
status: open
priority: low
tags: [automation, ai, messaging, v3]
created: 2026-03-21
assignee: unassigned
---

# Implement selective autopilot for safe intents

## Summary

Allow hosts to enable auto-send (no approval needed) for specific low-risk intents after confidence thresholds are met. Always log and allow rollback.

## Context

V3 of the plan: "Selective autopilot for 'safe intents' after thresholds: Wi-Fi, parking, basic how-tos; always log and allow rollback."

## Safe Intent Candidates

- Wi-Fi password questions
- Parking instructions
- Basic how-to questions (spa, sauna, pool) when structured data exists
- Check-in reminder (proactive, templated)
- Checkout reminder (proactive, templated)

## Requirements

- **Per-intent toggle**: hosts can enable/disable autopilot per intent type
- **Confidence threshold**: only auto-send when AI confidence is above configurable threshold
- **Logging**: every auto-sent message is fully logged with the same audit trail as approved messages
- **Rollback**: host can "undo" a sent message (mark as retracted, though can't unsend)
- **Dashboard**: show auto-sent messages distinctly, with confidence score and performance metrics
- **Safety rails**: escalation matrix overrides autopilot (high-stakes never auto-sent)
- **Gradual rollout**: start with 1-2 safest intents, expand based on acceptance rate data

## Prerequisites

- Ticket #007 (full intent taxonomy with confidence scores)
- Ticket #014 (escalation matrix to override autopilot)
- Significant draft acceptance rate data to justify automation

## Acceptance Criteria

- [ ] Per-intent autopilot toggle in settings
- [ ] Confidence threshold configurable per intent
- [ ] Auto-sent messages fully audited
- [ ] Escalation matrix overrides autopilot
- [ ] Host can review and flag auto-sent messages post-hoc

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 3 (V3 scope)
