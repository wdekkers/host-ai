import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Normalize an arbitrary phone string to E.164 format (+1XXXXXXXXXX).
 * Returns null if the input cannot be parsed as a valid US number.
 * Assumes US (+1) as the default country when no country code is present.
 */
export function toE164(raw: string): string | null {
  try {
    const parsed = parsePhoneNumber(raw, 'US');
    // isPossible() checks format and length without requiring the number to be
    // in an assigned carrier range — appropriate for accepting real business numbers.
    if (!parsed.isPossible()) return null;
    return parsed.format('E.164');
  } catch {
    return null;
  }
}

/** Returns true if the string is a possible E.164 number (correct format and length). */
export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value) && toE164(value) === value;
}
