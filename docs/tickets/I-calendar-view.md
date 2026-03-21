# I — Calendar view: multi-property reservations calendar

## Type
Feature

## Description
Add a Calendar entry to the sidebar navigation. When clicked, it shows a multi-property calendar view similar to HostAway — all active properties are shown as rows (or swimlanes), and reservations/turnovers are displayed as blocks on the calendar timeline.

## Scope

### 1. Sidebar navigation
- Add "Calendar" entry to the sidebar nav (`nav-links.ts`)
- Appropriate Lucide icon (e.g. `CalendarDays`)
- Route: `/calendar`

### 2. Calendar view layout
- Multi-property view: each active property is a row
- Timeline: horizontal date axis (default view: current month, with prev/next navigation)
- Reservation blocks: colored bars spanning check-in to check-out date
  - Show guest name on the block if space allows
  - Color-coded by status (confirmed, pending, etc.) using sky-600 palette
- Turnover indicators: visual marker on days where one guest checks out and another checks in

### 3. Interaction
- Click a reservation block → opens a side panel or navigates to reservation detail
- Hover → tooltip with guest name, check-in/check-out dates, property name
- Toggle between month view and week view

### 4. Filtering
- Filter by property (multi-select)
- Only active properties shown by default

### 5. Data
- Sourced from the `reservations` table, filtered by `orgId` and active properties
- No new API integrations required — uses existing reservation data

## Acceptance criteria
- [ ] `/calendar` route exists and is linked from sidebar
- [ ] All active properties shown as rows on the calendar
- [ ] Reservations displayed as timeline blocks with guest name
- [ ] Turnover days visually marked
- [ ] Month and week view toggle
- [ ] Clicking a reservation opens detail
- [ ] Only active properties displayed (respects the active/inactive flag from ticket D)
