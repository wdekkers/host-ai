---
id: "002"
title: Build approval queue UI — the command center landing page
status: open
priority: critical
tags: [ui, messaging, v1-core, command-center]
created: 2026-03-21
assignee: unassigned
---

# Build approval queue UI — the command center landing page

## Summary

Build the core approval queue page that shows AI-drafted message responses awaiting host action. This is the product's default landing page and primary interaction surface — the "communication command center" from the planning docs.

## Context

The planning docs are emphatic: "Default landing page is the queue." Currently, the app has `/inbox` and `/today` but no dedicated approval queue with a draft → approve/edit → send workflow. The `messages.suggestion` column stores AI drafts, but there's no UI for acting on them.

## Requirements

- **Queue view**: list of pending AI-drafted messages sorted by urgency/SLA
- **Each draft card shows**: guest name, property, intent label, time since received, urgency indicator
- **Actions per draft**: Preview full conversation, Edit draft, Approve & Send, Reject/Dismiss
- **Sources panel**: show which policy fields and knowledge entries were used to generate the draft
- **Escalation badges**: flag drafts that require manual handling (refunds, safety, etc.)
- **Filters**: by property, by intent type, by urgency
- **Landing page**: this should be the default redirect from `/`

## Technical Notes

- May need an `approval_queue` projection table or a status field on messages to track draft lifecycle (pending → approved → sent / rejected)
- Integrate with existing `generateReplySuggestion()` for draft content
- Send via Hospitable API after approval

## Acceptance Criteria

- [ ] Approval queue page exists and is the default landing page
- [ ] Drafts display with urgency sorting
- [ ] Host can preview, edit, approve/send, or reject each draft
- [ ] Sources/citations visible per draft
- [ ] Escalation items visually distinct
- [ ] Audit trail entry created on every action (approve, edit, reject, send)

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 9 (UX: Command Center)
- Planning doc: AI_STR_Monorepo_EventDriven_Architecture_v1.pdf — approval_queue projection
