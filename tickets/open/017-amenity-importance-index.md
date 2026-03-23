---
id: "017"
title: Add amenity importance index per property
status: open
priority: low
tags: [properties, amenities, ops, v1.5]
created: 2026-03-21
assignee: unassigned
---

# Add amenity importance index per property

## Summary

Allow each property to classify amenities as critical, important, or enhancer. This drives prioritization in the property state engine and incident response — a broken critical amenity (pool heater in summer) requires immediate action, while a broken enhancer (decorative lighting) can wait.

## Context

The plan includes "Amenity Importance Index: mark critical vs important vs enhancer per property" as part of the structured onboarding fields.

## Requirements

- Per-property amenity classification: `critical` / `important` / `enhancer`
- Integrate with property state engine (ticket #012) — critical amenity offline = property at risk
- Integrate with incident prioritization — critical amenity issues surface first
- Default importance levels based on amenity type, with per-property overrides

## Examples

| Amenity | Default | Override Example |
|---------|---------|-----------------|
| Pool heater | important | critical (summer property) |
| AC/HVAC | critical | — |
| Hot tub | important | critical (luxury property) |
| Wi-Fi | critical | — |
| Sauna | enhancer | important (ski lodge) |
| Outdoor lighting | enhancer | — |

## Acceptance Criteria

- [ ] Amenity importance field in schema
- [ ] Default importance by amenity type
- [ ] Per-property overrides
- [ ] Property state engine considers amenity importance
- [ ] UI for configuring importance per property

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 5 (Amenity Importance Index)
