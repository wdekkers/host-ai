---
id: "019"
title: Build portfolio intelligence and trend analytics
status: open
priority: low
tags: [analytics, intelligence, v3]
created: 2026-03-21
assignee: unassigned
---

# Build portfolio intelligence and trend analytics

## Summary

Implement portfolio-level analytics: recurring incidents, refund rate trends, amenity reliability, response-time KPIs, and cross-property pattern detection.

## Context

V3 of the plan calls for "Portfolio trends: recurring incidents, refund rate trends, amenity reliability, response-time KPI." This helps hosts identify systemic issues across their portfolio rather than firefighting one property at a time.

## Metrics to Track

- **Response time**: median time from guest message to reply, per property and overall
- **Incident rate**: incidents per reservation, trending over time
- **Refund rate**: total compensation as % of revenue, by property
- **Amenity reliability**: uptime/issue frequency per amenity per property
- **Review outcomes**: 5-star rate, complaint frequency, review sentiment
- **Draft acceptance rate**: how often hosts approve AI drafts without edits (proxy for AI quality)

## Requirements

- Time-series data storage for metrics
- Dashboard with charts showing trends over 30/90/180 day windows
- Cross-property comparison views
- Anomaly detection: alert when a metric significantly deviates from baseline
- Weekly owner intelligence report (email digest)

## Acceptance Criteria

- [ ] Key metrics tracked over time
- [ ] Dashboard with trend charts
- [ ] Cross-property comparison
- [ ] Anomaly alerts for significant deviations
- [ ] Weekly digest report

## References

- Planning doc: AI_STR_OS_Full_Plan_v1.pdf — Section 3 (V3 scope), Section 11 (Metrics)
- Planning doc: AI_STR_Startup_Plan_v1.pdf — Weekly Owner Intelligence Report
