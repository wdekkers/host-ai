/** Increment the version string whenever the consent text changes. */
export const CONSENT_TEXT_VERSION = 'v1';

/**
 * Exact text displayed above the opt-in checkbox on the web form.
 * This snapshot is stored in sms_consents.consent_text_snapshot on every opt-in.
 * NEVER change this without incrementing CONSENT_TEXT_VERSION.
 */
export const CONSENT_TEXT_V1 =
  'I agree to receive work-related text messages from WALT Services about ' +
  'scheduling, cleaning, maintenance, property access, and urgent operational ' +
  'issues. Message frequency varies. Reply STOP to opt out or HELP for help. ' +
  'Message and data rates may apply.';

/** SMS sent to vendor after successful opt-in. */
export const CONFIRMATION_SMS =
  "WALT Services: You're subscribed for work-related vendor texts about " +
  'scheduling and property operations. Msg frequency varies. Reply STOP to ' +
  'opt out, HELP for help.';

/** SMS sent to vendor after opt-out. */
export const OPT_OUT_SMS =
  "You've been unsubscribed from WALT Services vendor texts. Reply START to resubscribe.";

/** TwiML HELP reply text. */
export const HELP_SMS =
  'WALT Services: For scheduling, maintenance, and property operations support. ' +
  'Msg frequency varies. Reply STOP to unsubscribe. ' +
  'Contact support@waltservices.com for help.';

/** Keywords that trigger opt-out per TCPA / Twilio advanced opt-out rules. */
export const STOP_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'STOPALL']);

/** Keywords that trigger opt-in via inbound SMS. */
export const START_KEYWORDS = new Set(['START', 'UNSTOP']);
