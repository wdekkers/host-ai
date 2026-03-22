import { describe, it, expect } from 'vitest';
import { EventDeduplicator } from '../events.js';

describe('EventDeduplicator', () => {
  it('returns true for new event IDs', () => {
    const dedup = new EventDeduplicator();
    expect(dedup.isNew('evt-1')).toBe(true);
  });

  it('returns false for duplicate event IDs', () => {
    const dedup = new EventDeduplicator();
    dedup.isNew('evt-1');
    expect(dedup.isNew('evt-1')).toBe(false);
  });

  it('returns true for a previously-seen ID after clear()', () => {
    const dedup = new EventDeduplicator();
    dedup.isNew('evt-1');
    dedup.clear();
    expect(dedup.isNew('evt-1')).toBe(true);
  });

  it('evicts oldest entry when at capacity and treats evicted ID as new', () => {
    const dedup = new EventDeduplicator();
    for (let i = 0; i < 1000; i++) {
      dedup.isNew(`evt-${i}`);
    }
    // Adding one more evicts evt-0
    dedup.isNew('evt-new');
    // evt-0 was evicted, so it should be treated as new again
    expect(dedup.isNew('evt-0')).toBe(true);
    // evt-1 was not evicted yet
    expect(dedup.isNew('evt-1')).toBe(false);
  });
});
