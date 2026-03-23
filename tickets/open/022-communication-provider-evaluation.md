---
id: "022"
title: Evaluate communication providers (Telnyx vs Twilio alternatives)
status: open
priority: medium
tags: [integration, messaging, ops, infrastructure]
created: 2026-03-21
assignee: unassigned
---

# Evaluate communication providers (Telnyx vs Twilio alternatives)

## Summary

Evaluate alternatives to Twilio for unified SMS + email communication. Current Twilio verification process is blocking progress. Need inbound + outbound, 1-to-many group messaging for vendor/cleaner coordination.

## Requirements

- SMS/MMS: inbound + outbound
- Group messaging: 1-to-many threads (ops chat with multiple vendors/cleaners)
- Email: inbound + outbound (or pair with existing Resend)
- Node.js SDK available
- Webhook support for inbound messages
- Reasonable verification/compliance process

## Options to Evaluate

1. **Telnyx** (SMS) + **Resend** (email) — two providers, both developer-friendly
2. **Amazon SNS** (SMS) + **SES** (email) — one AWS account, no separate verification
3. **Plivo** (SMS) + Resend (email) — simple compliance
4. **Vonage** (SMS) — faster approval than Twilio

## Action Items

- [ ] Sign up for Telnyx developer account and test verification process
- [ ] Compare pricing: Telnyx vs Plivo vs Vonage for expected message volume
- [ ] Prototype inbound webhook handling with Telnyx SDK
- [ ] Assess migration effort from existing Twilio code in services/messaging
- [ ] Decide on email: keep Resend or consolidate

## Notes

- Existing Twilio integration code in `services/messaging` can serve as template
- Adapter pattern in codebase should make provider swap straightforward
- Resend is already set up and working — may be simplest to keep it for email
