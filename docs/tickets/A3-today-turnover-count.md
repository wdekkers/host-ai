# A3 — Today page: turnover count is incorrect

## Type
Bug fix

## Description
The number of turnovers displayed on the Today page does not reflect the actual number of turnovers for the day. The count is inaccurate.

## Expected behavior
The turnover count should reflect the number of reservations where check-out and/or check-in occur on the current day (i.e., a property needs to be cleaned and turned over between guests).

## Acceptance criteria
- [ ] Turnover count correctly counts properties with a checkout today (regardless of whether a new guest checks in the same day)
- [ ] Count is scoped to the current date
- [ ] Visually matches the actual number of turnover events visible elsewhere on the page
