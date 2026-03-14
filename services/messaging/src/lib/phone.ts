/**
 * Normalize an arbitrary phone string to E.164 format (+1XXXXXXXXXX).
 * Returns null if the input cannot be parsed as a valid US number.
 * Assumes US (+1) as the default country when no country code is present.
 */
export function toE164(raw: string): string | null {
  try {
    // Strip all non-digit characters except leading +
    const stripped = raw.replace(/[^\d+]/g, '');

    let digits: string;
    if (stripped.startsWith('+1') && stripped.length === 12) {
      digits = stripped.slice(2);
    } else if (stripped.startsWith('1') && stripped.length === 11) {
      digits = stripped.slice(1);
    } else if (/^\d{10}$/.test(stripped)) {
      digits = stripped;
    } else {
      return null;
    }

    // Validate 10-digit US NANP number: area code and exchange cannot start with 0 or 1
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;

    return `+1${digits}`;
  } catch {
    return null;
  }
}

/** Returns true if the string is a possible E.164 number (correct format and length). */
export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value) && toE164(value) === value;
}
