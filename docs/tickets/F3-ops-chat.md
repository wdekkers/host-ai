# F3 — Ops Chat: team messaging with group threads

## Type
Feature

## Description
A dedicated messaging page for operational team communication — cleaners, maintenance, contractors, etc. Lives under Overview alongside Inbox. Supports both 1-to-1 and group threads.

## Sidebar
- Label: "Ops Chat"
- Icon: `MessageSquareMore` or `MessagesSquare`
- Route: `/ops-chat`
- Roles: owner, manager, agent
- Position: under Overview, after Inbox

## Scope

### 1. Thread list (left panel)
- List of conversation threads sorted by last message
- Each thread shows: thread name (or participant name for 1-to-1), last message preview, timestamp, participant count badge for groups
- Search threads by name or participant
- "New Thread" button to create a thread

### 2. Thread types
- **1-to-1**: conversation with a single vendor/contact (like current vendor hub)
- **Group**: named thread with 2+ participants
  - Thread has a name (e.g., "Dreamscape Turnover 3/21")
  - Multiple participants selected from contacts

### 3. Group messaging (fan-out/fan-in)
- When sending a message in a group thread, SMS is sent individually to each participant via Twilio
- Inbound replies from any participant appear in the shared thread (matched by phone number)
- Each message shows which participant sent it

### 4. Conversation view (right panel)
- Message bubbles with sender name for group threads
- Scroll to latest message on open
- Compose and send SMS
- Show participant list in thread header

### 5. Thread management
- Create new thread: name (optional for 1-to-1), select participants from contacts
- Add/remove participants from existing group threads
- Thread participants linked to contacts table

## Database changes
- New table: `ops_threads` (id, organizationId, name, type: 'direct' | 'group', createdAt, updatedAt)
- New table: `ops_thread_participants` (id, threadId, contactId, phoneE164, joinedAt)
- New table: `ops_messages` (id, threadId, senderContactId, direction, body, twilioMessageSid, createdAt)
- Or: extend existing `smsMessageLogs` with a `threadId` field

## Acceptance criteria
- [ ] `/ops-chat` route exists under Overview in sidebar
- [ ] Thread list shows 1-to-1 and group threads
- [ ] Can create a new 1-to-1 thread by selecting a contact
- [ ] Can create a group thread with a name and multiple participants
- [ ] Sending in a group thread fans out SMS to all participants
- [ ] Inbound replies appear in the correct thread
- [ ] Scroll to latest message on thread open
- [ ] Thread header shows participant count and names
