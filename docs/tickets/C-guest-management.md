# C — Guest Management: ratings, host-again flag, rebook approval

## Type
Feature

## Description
Build a guest profile system that persists across reservations. For each guest we should be able to record a rating and a host-again decision (yes / no / undecided). When a guest attempts to rebook, we can use this data to approve or deny them automatically or manually.

## Scope

### 1. Guest profiles
- Store guest records linked to reservations (guest name, platform ID, email/phone if available)
- Profile persists across multiple stays — if the same guest books again, link to existing profile

### 2. Host-again flag
- Three states: `yes` (welcome back), `no` (deny), `undecided` (default)
- Settable manually by owner/manager from the guest profile or reservation detail
- Visible on the reservations list and guest profile

### 3. Guest rating
- Simple 1–5 star rating (or thumbs up/down — TBD during design)
- Notes field for internal comments (e.g. "left the place messy", "great guest, tipped cleaner")
- Only visible to org members, never surfaced to the guest

### 4. Rebook approval flow
- When a guest with `host-again: no` attempts to book again (detected via Hospitable webhook or reservation sync), flag the reservation for review
- Surface a warning on the reservation detail page
- Owner/manager can approve or deny the booking from the UI

## Database changes
- New table: `guests` (guestId, orgId, platformGuestId, name, email, phone, hostAgain, rating, notes, createdAt, updatedAt)
- `reservations` table: add `guestId` FK

## Acceptance criteria
- [ ] Guest profiles are created/linked when reservations sync
- [ ] Owner/manager can set host-again flag and rating from reservation detail
- [ ] Guest profile page shows all past stays, rating, notes, host-again status
- [ ] Reservations from guests flagged as `no` are highlighted with a warning
- [ ] Cleaner and viewer roles cannot edit guest profiles
