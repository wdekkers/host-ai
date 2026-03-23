---
id: "011"
title: Wire early check-in JIT cleaner workflow end-to-end
status: open
priority: medium
tags: [ops, messaging, workflow, v1.5]
created: 2026-03-21
assignee: unassigned
---

# Wire early check-in JIT cleaner workflow end-to-end

## Summary

Implement the full early check-in workflow: guest requests early check-in → AI classifies intent → drafts acknowledgement → pings cleaner via SMS → parses cleaner response (READY/ETA/NOT_READY) → drafts follow-up to guest → optional upsell. An entire planning doc is dedicated to this flow.

## Context

The pieces exist separately (ops chat for vendor messaging, SMS via Twilio, message classification) but the orchestrated workflow connecting them doesn't exist. This is the signature V1.5 operational workflow.

## Workflow Steps

1. Guest asks for early check-in
2. AI classifies intent = `EarlyCheckInRequest`, pulls context (property policy, turnover window, cleaner assignment, same-day checkout)
3. AI drafts guest acknowledgement: "Let me check with our cleaners..." → host approves
4. System sends cleaner ping via SMS: "Can you confirm ready by {time}? Reply READY or ETA hh:mm"
5. Cleaner replies → system parses into structured status (READY / ETA / NOT_READY)
6. AI drafts follow-up based on cleaner status:
   - READY → confirm early check-in
   - ETA → offer nearest available time
   - NOT_READY → politely decline, restate normal check-in
7. Optional: if policy allows paid early check-in AND readiness confirmed, propose upsell to host
8. Audit log records entire flow

## Prerequisites

- Ticket #006 (structured property fields — earlyCheckInPolicy, cleanerContact, turnoverBuffer)
- Ticket #007 (intent detection for EarlyCheckInRequest)
- Ticket #008 (templates 7, 8, 9 — early check-in request/approved/not available)

## Guardrails

- Never promise early check-in before cleaner confirmation
- Maintain configurable buffer window per property
- Upsell only when: policy permits, availability is real, channel-compliant
- Escalate if guest is upset or requests refund/comp

## Acceptance Criteria

- [ ] Guest early check-in message triggers the workflow
- [ ] Cleaner ping sent automatically after host approves acknowledgement
- [ ] Cleaner SMS response parsed into structured status
- [ ] Follow-up draft generated based on cleaner status
- [ ] Upsell logic fires when conditions are met
- [ ] Full audit trail for the entire flow

## References

- Planning doc: AI_STR_Early_CheckIn_Workflow_v1.pdf — Full workflow spec
