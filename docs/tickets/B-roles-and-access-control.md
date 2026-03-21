# B — Roles & Access Control

## Type
Feature

## Description
Expand the role system to include a `cleaner` role with restricted access, and ensure all features are gated behind the appropriate role. Update the AGENTS.md to require role-awareness in all future implementations.

## Current state
Roles exist: `owner`, `manager`, `agent`, `viewer`. No `cleaner` role. Feature gating is partially implemented but not consistently enforced across all pages and features.

## Scope

### 1. Add `cleaner` role
- New role: `cleaner`
- Cleaners should only have access to:
  - Checklists (their assigned property checklists)
  - Today page (limited: turnovers relevant to them only)
- Cleaners should NOT have access to:
  - Inbox, contacts, vendors, reservations, SEO, questions, settings, admin

### 2. Role-based feature gating
- Audit all pages/routes and ensure they check the user's role before rendering or returning data
- Owner: full access
- Manager: full access except platform configuration / admin
- Agent: inbox, tasks, today, reservations, checklists
- Cleaner: checklists, today (turnovers only)
- Viewer: read-only dashboard

### 3. Update AGENTS.md
- Add a section that instructs all future implementations to consider roles
- Every new feature or page should explicitly document which roles have access
- Every API route should include role/permission checks

## Acceptance criteria
- [ ] `cleaner` role exists in the role enum and permission map
- [ ] Cleaner users can access checklists and today page only
- [ ] All sidebar nav items are conditionally rendered based on role
- [ ] All API routes enforce role-based access
- [ ] AGENTS.md updated with role-awareness requirements
