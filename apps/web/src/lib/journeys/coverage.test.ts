import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinCoverageWindow, getNextWindowStart } from './coverage';
import type { CoverageSchedule } from '@walt/contracts';

const weekdaySchedule: CoverageSchedule = {
  timezone: 'America/New_York',
  windows: [
    { days: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 9, endHour: 22 },
  ],
};

void describe('isWithinCoverageWindow', () => {
  void it('returns true for null schedule', () => {
    const now = new Date('2026-03-25T18:00:00Z');
    assert.equal(isWithinCoverageWindow(null, now), true);
  });

  void it('returns true within window (Wednesday 2pm ET)', () => {
    // Wednesday 2pm ET = Wednesday 18:00 UTC (EDT = UTC-4)
    const now = new Date('2026-03-25T18:00:00Z');
    assert.equal(isWithinCoverageWindow(weekdaySchedule, now), true);
  });

  void it('returns false outside window hours (Wednesday 2am ET)', () => {
    // Wednesday 2am ET = Wednesday 06:00 UTC (EDT = UTC-4)
    const now = new Date('2026-03-25T06:00:00Z');
    assert.equal(isWithinCoverageWindow(weekdaySchedule, now), false);
  });

  void it('returns false on weekend for weekday-only schedule (Saturday 2pm ET)', () => {
    // Saturday 2pm ET = Saturday 18:00 UTC (EDT = UTC-4)
    const now = new Date('2026-03-28T18:00:00Z');
    assert.equal(isWithinCoverageWindow(weekdaySchedule, now), false);
  });
});

void describe('getNextWindowStart', () => {
  void it('returns correct next window (from Saturday, next window is Monday 9am)', () => {
    // Saturday 2pm ET = Saturday 18:00 UTC
    const now = new Date('2026-03-28T18:00:00Z');
    const next = getNextWindowStart(weekdaySchedule, now);

    // Monday 9am ET = Monday 13:00 UTC (EDT = UTC-4)
    const expectedUTC = new Date('2026-03-30T13:00:00Z');
    assert.equal(next.toISOString(), expectedUTC.toISOString());
  });
});
