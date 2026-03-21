# E — Checklists: categories, global/property-specific, active properties only

## Type
Feature improvement

## Description
The checklist system needs to be more powerful and better organized. We need support for:
1. Global checklists (apply to all properties) vs. property-specific checklists
2. Checklist categories (turnover, house manager, cleaner, etc.)
3. Only active properties appear in the property selector

## Scope

### 1. Checklist categories
- New `category` field on checklists
- Predefined categories (extensible):
  - `turnover` — for cleaners doing a full property turnover
  - `house_manager` — for the house manager inspection/setup
  - `maintenance` — for maintenance checks
  - `seasonal` — seasonal prep checklists
- Checklists can be filtered by category in the UI
- Role-based visibility: cleaners see `turnover` and `cleaner` categories only

### 2. Global vs. property-specific
- `scope` field: `global` or `property`
- Global checklists apply to all active properties and appear in every property's checklist view
- Property-specific checklists are tied to a single property
- When executing a checklist for a property, show both global and property-specific checklists

### 3. Active properties only
- Property selector in checklists only shows active properties
- Inactive properties are excluded from all checklist assignment and execution views

### 4. UI improvements
- Sidebar/filter for category
- Clear labeling of global vs. property-specific checklists
- Assign checklist to a role (e.g. this checklist is for cleaners)

## Database changes
- `checklists` table (if not exists): add `category` (enum/string) and `scope` (`global` | `property`) fields
- `checklists`: add `assignedRole` field (optional — which role this checklist targets)

## Acceptance criteria
- [ ] Checklists can be created as global or property-specific
- [ ] Checklists have a category (turnover, house_manager, maintenance, seasonal)
- [ ] Checklist view shows global + property-specific checklists for the selected property
- [ ] Property selector only shows active properties
- [ ] Cleaners only see checklists relevant to their role/category
- [ ] Owner/manager can filter checklists by category
