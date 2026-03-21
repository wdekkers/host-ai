import { DEDUP_MAX_SIZE } from './const.js';

export type EventKind = 'ding' | 'motion' | 'intercom_unlock';

export interface RingEvent {
  id: string;
  deviceId: string;
  locationId: string;
  kind: EventKind;
  timestamp: Date;
  answered?: boolean;  // absent for motion events
}

export type EventCallback = (event: RingEvent) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * Bounded deduplication tracker.
 * Tracks up to DEDUP_MAX_SIZE event IDs. When full, evicts oldest before inserting.
 * Evicted IDs enter a one-shot "evicted" set: the next isNew call for an evicted ID
 * returns true (the event has left the dedup window) without consuming a slot in seen.
 * Resets on process restart — events received while offline will re-emit on first poll (acceptable).
 */
export class EventDeduplicator {
  private seen = new Map<string, true>();
  private evicted = new Set<string>();

  /** Returns true if the event is new and should be emitted. Registers the ID. */
  isNew(eventId: string): boolean {
    if (this.seen.has(eventId)) return false;

    // If this ID was recently evicted, treat it as new without reinserting into seen.
    // This preserves the capacity invariant and prevents cascading evictions.
    if (this.evicted.has(eventId)) {
      this.evicted.delete(eventId);
      return true;
    }

    if (this.seen.size >= DEDUP_MAX_SIZE) {
      const oldestKey = this.seen.keys().next().value;
      if (oldestKey !== undefined) {
        this.seen.delete(oldestKey);
        this.evicted.add(oldestKey);
      }
    }
    this.seen.set(eventId, true);
    return true;
  }

  clear(): void {
    this.seen.clear();
    this.evicted.clear();
  }
}
