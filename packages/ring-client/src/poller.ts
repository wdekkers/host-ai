import { POLL_INTERVAL_MS } from './const.js';
import type { EventCallback, EventDeduplicator, RingEvent } from './events.js';
import type { RingDevice } from './devices.js';
import type { HttpClient } from './http.js';

interface RawHistoryEntry {
  id: string | number;
  kind?: string;
  created_at?: string;
  answered?: boolean;
}

interface PollerOptions {
  devices: RingDevice[];
  get: HttpClient['get'];
  dedup: EventDeduplicator;
  onEvent: EventCallback;
}

export interface Poller {
  poll: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

function normalizeKind(kind: string | undefined): RingEvent['kind'] {
  if (kind === 'motion') return 'motion';
  if (kind === 'intercom_unlock') return 'intercom_unlock';
  return 'ding';
}

export function createPoller(options: PollerOptions): Poller {
  const { devices, get, dedup, onEvent } = options;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll(): Promise<void> {
    for (const device of devices) {
      try {
        const history = await get<RawHistoryEntry[]>('/doorbots/history', {
          doorbot_id: device.id,
          limit: '10',
        });

        for (const entry of history) {
          const id = String(entry.id);
          if (!dedup.isNew(id)) continue;

          const event: RingEvent = {
            id,
            deviceId: device.id,
            locationId: device.locationId,
            kind: normalizeKind(entry.kind),
            timestamp: entry.created_at ? new Date(entry.created_at) : new Date(),
            ...(entry.answered !== undefined ? { answered: entry.answered } : {}),
          };

          onEvent(event);
        }
      } catch {
        // Silently skip failed device — don't crash the whole loop
      }
    }
  }

  return {
    poll,
    start() {
      timer = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
