# J — Calendar: daily rates from Hospitable

## Type
Feature

## Description
Add nightly rate and total price to the calendar view. Hospitable's reservation API includes pricing data in the response — we already store the full raw JSON but don't extract price fields. Extract them during sync and display in the calendar.

## Scope

### 1. Schema
- Add `totalPrice`, `nightlyRate`, `currency` columns to `reservations` table
- Extract from Hospitable raw reservation data during sync

### 2. Sync
- Update `normalizeReservation` to extract price fields from raw JSON
- Fields to look for: `total_price`, `nightly_rate`, `payout`, `price`, `currency`

### 3. Calendar display
- Show nightly rate on reservation bars (if available)
- Show rate in empty cells between bookings (if property has a base rate)

### 4. API
- Include price fields in the calendar API response

## Acceptance criteria
- [ ] Reservation sync extracts pricing from Hospitable
- [ ] Calendar bars show nightly rate when available
- [ ] Reservation popup shows total price and nightly rate
