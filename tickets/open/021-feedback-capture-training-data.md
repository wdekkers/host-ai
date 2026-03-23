---
id: "021"
title: Capture host edit feedback as training data
status: open
priority: medium
tags: [ai, data, feedback, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Capture host edit feedback as training data

## Summary

When a host edits an AI draft before sending, capture the before/after diff and optional reason tag. This creates the training/evaluation dataset that is the product's data moat.

## Context

The plan emphasizes: "AI draft → host edit → final message → guest outcome. This becomes the training/evaluation backbone and the strongest defensibility." The planning docs also mention: "You generate real training data from your own edits without customer risk."

## Requirements

- **Edit tracking**: when host modifies a draft, store both original draft and final sent version
- **Diff storage**: compute and store the meaningful changes (not just two blobs)
- **Quick reason tags**: optional tag on edits — "too formal", "wrong info", "missing context", "wrong tone", "factually incorrect", "added detail", "other"
- **Outcome tracking**: link to guest response/review outcome when available
- **Analytics**: dashboard showing edit rate by intent, common edit patterns, improvement over time

## Data Moat Elements (from plan)

- Conversation → outcome (did guest comply? did review improve? did upsell convert?)
- Ops events → cost (pool heat usage, misuse incidents, vendor calls)
- Pricing decisions → booking outcomes (ADR, occupancy, lead time)

## Acceptance Criteria

- [ ] Original draft and edited version both stored
- [ ] Optional reason tag UI for edits
- [ ] Edit rate metrics available per intent type
- [ ] Data exportable for model evaluation/fine-tuning

## References

- Planning doc: AI_STR_Architecture_and_Scaling_Path_v1.pdf — Data Moat to Build Early
- Planning doc: AI_STR_Monorepo_EventDriven_Architecture_v1.pdf — Feedback capture
