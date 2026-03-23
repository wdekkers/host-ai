---
id: "013"
title: Implement guest risk/trust scoring visible to host
status: open
priority: medium
tags: [ai, guests, risk, trust, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Implement guest risk/trust scoring visible to host

## Summary

Build a risk/trust assessment system for guests that shows reasons and recommendations to the host — never just a number. Trust is portable (guest reputation), risk is local (property tolerance differs).

## Context

The plan specifies this for V1 (visible for booking requests/inquiries, draft-only, no auto-decline). The `/command-center/risk-intelligence` route exists but may be a placeholder.

## Risk Signals

- **Booking patterns**: locals, same-day, weekend 1-night, large group size, vague purpose
- **Profile**: low reviews, new account, weak verifications, negative host feedback phrasing
- **Language**: negotiation, evasiveness, rule pushback, aggression
- **Policy violations**: event request, over-occupancy, visitor request

## Trust Signals

- Strong review history and positive host language
- Fast, clear responses; explicit house rules acceptance
- Cooperative tone and transparent trip purpose

## Requirements

- Risk/trust assessment runs on new booking requests and inquiry messages
- Score includes: risk level (low/medium/high), trust level (low/medium/high), list of contributing signals with explanations
- Show as badges/cards in the approval queue and reservation detail
- **Never auto-decline** — draft-only with recommendation
- Per-property tolerance settings (some properties tolerate higher risk)

## Technical Notes

- Can use LLM analysis of guest messages for language signals
- Booking pattern analysis from reservation data
- Consider a `guest_assessments` table to store per-booking risk evaluations

## Acceptance Criteria

- [ ] Risk/trust assessment generated for booking requests
- [ ] Signals shown with explanations (not just a score)
- [ ] Visible in approval queue and reservation detail
- [ ] No automated decline — recommendations only
- [ ] Assessment stored for audit trail

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 7 (Guest Risk & Trust)
