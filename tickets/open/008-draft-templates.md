---
id: "008"
title: Codify draft message templates with variable injection
status: open
priority: high
tags: [ai, messaging, templates, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Codify draft message templates with variable injection

## Summary

Create structured message templates for each V1 intent that inject property-specific variables. The AI should use these as the backbone of its drafts rather than generating entirely freeform responses.

## Context

The planning docs provide 12 concrete templates with variables like `{GuestName}`, `{PropertyName}`, `{CheckInTime}`, etc. The principle is "structured truth > model improvisation" — templates grounded in structured data with the LLM adding warmth and clarity.

## Templates to Implement

1. Booking Request Reply
2. House Rules Acknowledgement
3. Check-in Reminder / Arrival Instructions
4. First-Morning Check-in
5. Checkout Instructions
6. Pool Heating (info)
7. Early Check-in Request (JIT cleaner check)
8. Early Check-in Approved
9. Early Check-in Not Available
10. Late Checkout Request (policy + availability)
11. Spa/Hot Tub — How it works + rules
12. Sauna — How it works + safety

## Requirements

- Templates stored in a structured format (code constants or DB table)
- Each template defines: required variables, optional variables, fallback text for missing variables
- Variable resolution pulls from structured property fields (ticket #006)
- LLM uses template as a constraint/starting point, not as a rigid copy
- If required fields are missing, draft includes a "missing context" note for the host
- Templates are per-intent, with property-level overrides possible

## Technical Notes

- Consider storing in `packages/ai` or a new `templates` package
- Template + structured fields → LLM prompt → personalized draft
- This is different from the current freeform `generateReplySuggestion()` approach

## Acceptance Criteria

- [ ] All 12 templates defined with variable schemas
- [ ] Draft generation uses template as base when intent is classified
- [ ] Missing required variables flagged in draft output
- [ ] Templates configurable/overridable per property

## References

- Planning doc: AI_STR_Top_Intents_and_Templates_v1.pdf — All 12 draft templates
