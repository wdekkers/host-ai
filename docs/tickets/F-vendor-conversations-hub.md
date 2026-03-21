# F — Vendor Conversations Hub

## Type
Feature

## Description
Replace the current vendor admin page with a dedicated **vendor messaging hub** — a central place to have conversations with vendors (cleaners, maintenance, suppliers, etc.) via SMS. This lives under the Overview section in the sidebar alongside the guest Inbox, acting as the operations-side communication channel.

The guest Inbox handles guest conversations. This hub handles vendor/team conversations.

## Suggested name
"Vendors" or "Operations" or "Team" — to be decided. Should feel like a peer to "Inbox" but clearly scoped to internal/vendor communication.

## Scope

### 1. Sidebar placement
- Add entry under **Overview** in `nav-links.ts` (alongside Today, Inbox, Tasks)
- Suitable Lucide icon (e.g. `HardHat`, `Wrench`, `Users`, `MessageSquare`)
- Route: `/vendors` or `/operations` (TBD on naming)

### 2. Vendor conversation list
- Left panel: list of vendors with their name, company, last message preview, and timestamp
- Mirrors the inbox conversation list pattern
- Search/filter vendors by name or company
- Preferred vendors shown at top (star/badge indicator)

### 3. Conversation thread
- Right panel: SMS conversation thread with the selected vendor
- Shows sent/received messages (from existing `smsMessageLogs`)
- Compose and send new SMS from within the hub
- Scroll to latest message on open (same fix as A2)

### 4. Preferred flag
- Vendors can be marked as preferred (star icon)
- Preferred vendors float to the top of the list
- Settable from the conversation header or vendor detail

### 5. Vendor management (lightweight)
- Ability to add a new vendor (name, company, phone) from within the hub
- View/edit vendor details from a side panel or modal
- SMS opt-in/opt-out status visible per vendor

### 6. Current `/admin/vendors` page
- Can be removed or repurposed — vendor management now lives inside the hub
- Redirect `/admin/vendors` to the new route

## Relationship to Contacts
- Contacts (`/contacts`) remains for guests and general external contacts
- This hub is specifically for operational vendor SMS conversations
- Vendors are still stored in the `vendors` table (no merge needed)

## Acceptance criteria
- [ ] New route exists under Overview in the sidebar
- [ ] Vendor list panel shows all vendors with last message and preferred flag
- [ ] Conversation thread shows SMS history per vendor
- [ ] New messages can be composed and sent from the hub
- [ ] Scroll-to-latest on conversation open
- [ ] Preferred flag toggleable per vendor
- [ ] New vendor can be added from within the hub
- [ ] Old `/admin/vendors` route removed or redirected
