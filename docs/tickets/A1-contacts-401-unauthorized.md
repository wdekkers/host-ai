# A1 — Contacts page throws 401 Unauthorized

## Type
Bug fix

## Description
The `/contacts` page is returning a 401 Unauthorized error when accessed. The page fails to load and no contact data is displayed.

## Expected behavior
The contacts page loads successfully and displays the list of contacts for the organization.

## Steps to reproduce
1. Navigate to `/contacts` in the sidebar
2. Observe 401 Unauthorized error

## Acceptance criteria
- [ ] `/contacts` page loads without errors for all roles that should have access
- [ ] Appropriate auth context is passed to the API route
- [ ] Unauthorized roles receive a proper access-denied UI, not a raw error
