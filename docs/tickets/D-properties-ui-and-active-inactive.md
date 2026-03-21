# D — Properties page: UI redesign + active/inactive toggle

## Type
Feature / UI improvement

## Description
The properties page currently shows multiple properties with a flat list of links beneath each one, which is cluttered and hard to scan. It needs a proper redesign. Additionally, some properties are duplicates or no longer active — we need to be able to mark properties as active or inactive, and inactive properties should be hidden from other parts of the app.

## Scope

### 1. Properties page UI redesign
- Replace the current flat link list with a proper card-based layout
- Each property card should show:
  - Property name and address
  - Active/inactive status badge
  - Key stats (upcoming reservations, current guest if applicable)
  - Quick-action links (inbox, tasks, knowledge, agent settings) as icon buttons, not bare text links
- Consider a grid layout (2-3 columns) for easier scanning

### 2. Active/inactive toggle
- Add `isActive` boolean to the `properties` table (may already exist as `status`)
- Owner/manager can toggle a property active or inactive from the property card or a settings page
- Inactive properties are visually dimmed on the properties page
- A filter toggle: "Show inactive" (off by default)

### 3. Propagate active/inactive to rest of app
- Checklists: only show active properties in property selector
- Today page: only count turnovers for active properties
- Inbox: only show conversations for active properties (or clearly label inactive ones)
- Reservations: inactive properties can be filtered out

## Acceptance criteria
- [ ] Properties page uses card-based layout following shadcn Card components and sky-600 accent
- [ ] Each card has quick-action icon buttons (not bare text links)
- [ ] Owner/manager can mark a property as active or inactive
- [ ] Inactive properties are hidden by default across the app (checklists, today, etc.)
- [ ] "Show inactive" filter available on properties page
