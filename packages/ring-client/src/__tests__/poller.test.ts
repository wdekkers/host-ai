import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPoller } from '../poller.js';
import { EventDeduplicator } from '../events.js';
import type { RingDevice } from '../devices.js';

const mockDevice: RingDevice = {
  id: 'dev-1',
  locationId: 'loc-1',
  kind: 'doorbell',
  description: 'Front Door',
};

describe('createPoller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits new events from history', async () => {
    const mockGet = vi.fn().mockResolvedValue([
      { id: 'evt-1', kind: 'ding', created_at: '2026-01-01T10:00:00Z', answered: true },
    ]);
    const onEvent = vi.fn();

    const poller = createPoller({
      devices: [mockDevice],
      get: mockGet,
      dedup: new EventDeduplicator(),
      onEvent,
    });
    await poller.poll();

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: 'evt-1',
      kind: 'ding',
      deviceId: 'dev-1',
      locationId: 'loc-1',
      answered: true,
    }));
  });

  it('does not emit duplicate events across polls', async () => {
    const mockGet = vi.fn().mockResolvedValue([
      { id: 'evt-1', kind: 'ding', created_at: '2026-01-01T10:00:00Z' },
    ]);
    const onEvent = vi.fn();

    const poller = createPoller({
      devices: [mockDevice],
      get: mockGet,
      dedup: new EventDeduplicator(),
      onEvent,
    });
    await poller.poll();
    await poller.poll();

    expect(onEvent).toHaveBeenCalledOnce();
  });

  it('does not poll after stop() is called', async () => {
    const mockGet = vi.fn().mockResolvedValue([]);
    const poller = createPoller({
      devices: [mockDevice],
      get: mockGet,
      dedup: new EventDeduplicator(),
      onEvent: vi.fn(),
    });

    poller.start();
    poller.stop();

    await vi.runAllTimersAsync();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
