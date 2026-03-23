---
id: "006"
title: Add structured onboarding fields to properties table
status: open
priority: high
tags: [database, properties, onboarding, v1-core]
created: 2026-03-21
assignee: unassigned
---

# Add structured onboarding fields to properties table

## Summary

Expand the `properties` table with the structured policy and onboarding fields that the AI needs to generate accurate, policy-grounded drafts. Currently the AI relies on freeform knowledge entries; the plan requires structured fields as the authoritative source.

## Context

The planning docs state: "LLM must not invent policies; it retrieves structured policy first, then RAG snippets for details." Many of the plan's must-have fields are missing from the schema.

## Required Fields (per property)

**Timing & Access:**
- `checkInTime`, `checkOutTime` (time)
- `earliestCheckIn`, `latestCheckOut` (time, nullable)
- `earlyCheckInPolicy` (jsonb — allowed, conditions, pricing tiers, earliest bound)
- `lateCheckOutPolicy` (jsonb — allowed, conditions, pricing tiers, latest bound)
- `entryMethod` (jsonb — lock type, code activation time, backup entry steps)
- `parkingInstructions` (text)
- `wifiName`, `wifiPassword` (text)

**House Rules:**
- `maxOccupancy` (int)
- `visitorPolicy` (text)
- `quietHoursStart`, `quietHoursEnd` (time)
- `smokingPolicy`, `petPolicy`, `partyPolicy` (text or enum)
- `cameraDisclosure` (text)

**Amenities:**
- `poolHeatingConfig` (jsonb — available, price/day, lead time, target temp, weather caveats)
- `spaConfig` (jsonb — cover instructions, controls, heating notes, misuse fee language)
- `saunaConfig` (jsonb — power instructions, temp/time guidance, safety bullets)

**Operations:**
- `cleanerContactId` (FK to contacts/vendors)
- `cleanerChannel` (enum: sms, email)
- `cleanerResponseFormat` (text — e.g., "READY/ETA/NOT READY")
- `turnoverBufferMinutes` (int)
- `thermostatSetting` (text)
- `checkoutSteps` (jsonb — array of required checkout tasks)

**Brand & Escalation:**
- `brandVoice` (jsonb — warmth level, emoji yes/no, strictness, apology style)
- `escalationMatrix` (jsonb — which scenarios require human approval)
- `amenityImportance` (jsonb — critical/important/enhancer per amenity)

## Technical Notes

- Some fields may be better as a separate `property_policies` table to keep `properties` from bloating
- Migration should be additive (all new columns nullable initially)
- Update `generateReplySuggestion()` to pull structured fields before knowledge entries
- Consider a property onboarding completeness score (% of fields filled)

## Acceptance Criteria

- [ ] Schema migration adds all required structured fields
- [ ] AI draft generation uses structured fields as primary source
- [ ] Knowledge entries used as fallback/supplement, not primary
- [ ] Property detail UI shows onboarding completeness

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 5 (Property Brain)
- Planning doc: AI_STR_Top_Intents_and_Templates_v1.pdf — Required structured onboarding fields
