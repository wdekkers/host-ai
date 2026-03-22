---
id: "007"
title: Expand intent detection to cover all V1 intents
status: open
priority: high
tags: [ai, messaging, intents, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Expand intent detection to cover all V1 intents

## Summary

Ensure the message classification system (`classify-message.ts`) reliably detects all 10 V1 intents and routes them to the correct handling logic.

## Context

The plan defines 10 top intents for V1. The classification system exists but needs to be verified/expanded to cover them all with structured routing.

## V1 Intent List

1. **Booking request reply** (pre-booking inquiry)
2. **House rules acknowledgement** (require acceptance)
3. **Check-in reminder / arrival instructions**
4. **First-morning check-in** (proactive "everything OK?")
5. **Checkout instructions**
6. **Pool heating** (info, pricing, scheduling)
7. **Early check-in request** (triggers JIT cleaner check)
8. **Late checkout request** (availability + optional upsell)
9. **Spa/hot tub how-to + rules**
10. **Sauna how-to + safety**

## Requirements

- Each intent should have a defined enum/type in `packages/contracts`
- Classification should return: `intent`, `confidence`, `requires_escalation` flag
- Low-confidence classifications should be flagged for host review
- Intent label should be displayed in the approval queue (ticket #002)
- Each intent should map to a handling strategy (which structured fields to pull, which template pattern to use)

## Acceptance Criteria

- [ ] All 10 intents defined as an enum/type
- [ ] Classification function handles all 10 with test coverage
- [ ] Confidence threshold below which drafts are flagged as uncertain
- [ ] Intent label persisted with each draft for audit purposes

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 6 (Intent Taxonomy)
- Planning doc: AI_STR_Top_Intents_and_Templates_v1.pdf — Top intents list
