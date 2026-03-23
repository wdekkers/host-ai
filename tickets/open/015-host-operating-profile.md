---
id: "015"
title: Add Host Operating Profile (HOP)
status: open
priority: low
tags: [settings, personalization, v3]
created: 2026-03-21
assignee: unassigned
---

# Add Host Operating Profile (HOP)

## Summary

Implement a Host Operating Profile that tunes AI behavior to match the host's operational philosophy: strictness level, generosity with compensation, economic sensitivity, and per-property tolerance settings.

## Context

The plan states: "Not all hosts act like you. Add a Host Operating Profile to tune: strictness, generosity, compensation tendencies, and economic sensitivity. AI recommendations align to the host's profile and property tolerance." This is a V3 feature but the data model can be designed earlier.

## Profile Dimensions

- **Strictness**: how firmly house rules are enforced (flexible → strict)
- **Generosity**: tendency toward goodwill gestures (conservative → generous)
- **Compensation style**: when and how much to offer (reluctant → proactive)
- **Economic sensitivity**: tolerance for revenue loss vs guest satisfaction
- **Communication warmth**: casual/emoji-friendly vs formal/professional

## Requirements

- Profile stored at the organization/account level
- Per-property overrides for tolerance settings
- AI draft generation references HOP when making tone and recommendation decisions
- Settings UI for hosts to configure their profile

## Acceptance Criteria

- [ ] HOP schema defined (organization-level with property overrides)
- [ ] AI draft generation considers HOP settings
- [ ] Settings UI for configuring profile
- [ ] Compensation recommendations aligned to HOP

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 7 (Host Operating Profile)
