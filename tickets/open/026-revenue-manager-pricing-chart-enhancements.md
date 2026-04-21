# Revenue Manager: pricing chart enhancements

Deferred items from the Slice 1 (PriceLabs connector + snapshots) brainstorm. Slice 1 ships **option B** (recommended + published price lines with booking overlay). These are the options we explicitly chose not to do on day one — captured so they don't get lost.

## Deferred

### Min-stay / constraint overlay (was option C)

Add a secondary row under the main price chart showing the `min_stay` rule per date (1 / 2 / 3 / 4+ nights). Doubles the chart's analytic value because most revenue detectors in `docs/ai-revenue-manager-plan.md` (gap-night risk, min-stay friction) reason jointly about pricing **and** stay rules.

- Requires storing `min_stay`, `closed_to_arrival`, `closed_to_departure` alongside every daily snapshot (already in the Slice 1 data model — no migration needed).
- Needs a second chart row or synced sub-chart; roughly doubles the chart component's complexity.
- Priority: bump when Slice 2 (rules engine) lands — detectors reading this field will make the overlay more valuable.

### Historical "ghost line" (was option D)

Add a dashed line showing what PriceLabs recommended N days ago for each upcoming date (N = 7, maybe configurable). Visualizes when PriceLabs is dropping recommendations in response to softening demand, which is a much stronger early-warning signal than looking at only today's numbers.

- Requires querying the daily snapshots table for the snapshot closest to `today - N days`.
- Only useful once ≥7 days of snapshots have accumulated — premature to ship at slice 1.
- Priority: visit when slice 1 has been in production for ≥2 weeks so there's enough history to be useful.

## Not doing (out of scope entirely)

- Interactive date-range selector / zoom — the 90-day forward window is fixed for v1.
- Tooltip hover with full detail cards — basic recharts tooltip only.
- Export / download buttons.
- Comparison across properties on the same chart.

## Related

- Spec: (will be created at `docs/superpowers/specs/2026-04-20-revenue-manager-slice-1-design.md`)
- Plan source: `docs/ai-revenue-manager-plan.md`
