# F2 — Contacts: strip to address book only

## Type
Refactor

## Description
The contacts page (`/contacts`) currently combines a contact list with a messaging interface. Strip the messaging out — contacts should be a pure address book. All messaging moves to Ops Chat.

## Scope

### 1. Address book layout
- List of contacts with: name, company, phone, email, type (vendor/contractor/staff), preferred flag
- Search/filter by name, company, or type
- Add new contact form
- Edit contact details (inline or modal)
- Mark as preferred (star)

### 2. Remove messaging
- Remove the conversation thread panel from ContactCenter
- Remove the message composer
- Remove all `/api/messaging/messages` calls from the contacts page

### 3. Contact types
- Each contact has a `type` field: vendor, contractor, staff, other
- Filterable by type

## Acceptance criteria
- [ ] `/contacts` shows a clean address book list with no messaging
- [ ] Contacts can be added, edited, searched, and marked as preferred
- [ ] Contact types are filterable
- [ ] No conversation thread or composer on the contacts page
