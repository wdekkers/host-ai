# A2 — Inbox: remove outer margins, scroll to latest message

## Type
Bug fix / UX improvement

## Description
Two issues with the inbox:

1. **Margins**: The inbox conversation view has outer margins causing it to not fill the available space. It should fill edge-to-edge within the layout container.
2. **Scroll position**: When a conversation is clicked/opened, the view does not automatically scroll to the most recent message. Users have to manually scroll down to see the latest messages.

## Acceptance criteria
- [ ] Inbox conversation pane fills the full available width/height with no outer padding/margin gaps
- [ ] Opening a conversation automatically scrolls to the bottom (most recent message)
- [ ] Scroll-to-bottom also triggers when a new message arrives while the conversation is open
