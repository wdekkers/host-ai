---
id: "014"
title: Implement structured escalation matrix
status: open
priority: medium
tags: [ai, safety, escalation, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Implement structured escalation matrix

## Summary

Convert the escalation rules from freeform text in agent config to a structured, enforceable matrix that prevents the AI from auto-handling high-stakes scenarios.

## Context

The agent config has `escalationRules` as a text field. The plan requires a structured matrix where certain categories **always** require human approval, regardless of AI confidence.

## Always-Escalate Categories

- Refund/compensation requests
- Safety incidents
- Accusations or threats
- Claims of injury
- Threats of bad reviews
- Policy exceptions
- Money collection
- Guest expressing anger/distress

## Requirements

- **Structured schema**: escalation categories with severity levels and required actions
- **Enforcement**: message classification checks against escalation matrix before allowing auto-draft
- **UI indicators**: escalated items in the approval queue are visually distinct (red/warning badges)
- **Per-property overrides**: some properties may have stricter or looser escalation rules
- **Audit**: every escalation decision is logged with the triggering signal

## Technical Notes

- Could be a jsonb field on properties or a separate `escalation_rules` table
- Classification pipeline must check escalation matrix after intent detection
- Integrate with draft generation — escalated drafts should include a note to the host about why

## Acceptance Criteria

- [ ] Escalation matrix defined as structured data (not freeform text)
- [ ] Message classification checks escalation matrix
- [ ] Escalated items flagged distinctly in approval queue
- [ ] Per-property overrides supported
- [ ] Escalation decisions audited

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 5 (Escalation matrix)
- Planning doc: AI_STR_Top_Intents_and_Templates_v1.pdf — Escalation rules (v1)
