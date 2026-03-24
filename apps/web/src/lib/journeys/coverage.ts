import type { CoverageSchedule } from '@walt/contracts';

type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * Maps the short English weekday name returned by Intl.DateTimeFormat
 * (e.g. "Mon", "Tue") to our lowercase 3-char day key.
 */
function getLocalDayAndHour(
  utcDate: Date,
  timezone: string,
): { day: DayOfWeek; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);

  const weekdayPart = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';

  const day = weekdayPart.slice(0, 3).toLowerCase() as DayOfWeek;
  // hour12: false returns 0-23; '24' can appear for midnight in some locales — normalise it
  const hour = parseInt(hourPart, 10) % 24;

  return { day, hour };
}

/**
 * Returns true if `now` (UTC) falls within any window of the coverage schedule.
 * If schedule is null the journey is always active.
 */
export function isWithinCoverageWindow(
  schedule: CoverageSchedule | null,
  now: Date,
): boolean {
  if (schedule === null) {
    return true;
  }

  const { day, hour } = getLocalDayAndHour(now, schedule.timezone);

  return schedule.windows.some(
    (window) =>
      window.days.includes(day) &&
      hour >= window.startHour &&
      hour < window.endHour,
  );
}

/**
 * Walks forward hour-by-hour (up to 168 hours = 7 days) to find the next
 * UTC time that falls within a coverage window.
 * Falls back to now + 24 hours if no window is found.
 */
export function getNextWindowStart(
  schedule: CoverageSchedule,
  now: Date,
): Date {
  const MS_PER_HOUR = 60 * 60 * 1000;
  const MAX_HOURS = 168;

  for (let i = 1; i <= MAX_HOURS; i++) {
    const candidate = new Date(now.getTime() + i * MS_PER_HOUR);
    if (isWithinCoverageWindow(schedule, candidate)) {
      return candidate;
    }
  }

  // Fallback: 24 hours from now
  return new Date(now.getTime() + 24 * MS_PER_HOUR);
}
