import { describe, it, expect, vi } from 'vitest';
import { createFcmListener } from '../fcm.js';
import type { FcmNotification } from '../fcm.js';
import { EventDeduplicator } from '../events.js';

describe('createFcmListener', () => {
  it('sets status to degraded when receiver factory throws', async () => {
    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent: vi.fn(),
      dedup: new EventDeduplicator(),
      createReceiver: () => { throw new Error('FCM unavailable'); },
    });

    await listener.start();
    expect(listener.getStatus()).toBe('degraded');
  });

  it('sets status to connected when receiver registers successfully', async () => {
    const mockReceiver = {
      getToken: vi.fn().mockResolvedValue('fcm-token-123'),
      onNotification: vi.fn(),
      destroy: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{}', { status: 200 })
    ));

    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent: vi.fn(),
      dedup: new EventDeduplicator(),
      createReceiver: () => mockReceiver,
    });

    await listener.start();
    expect(listener.getStatus()).toBe('connected');
    expect(mockReceiver.getToken).toHaveBeenCalled();
  });

  it('emits parsed ding event from FCM notification', async () => {
    const onEvent = vi.fn();
    let capturedCallback: ((notification: FcmNotification) => void) | undefined;

    const mockReceiver = {
      getToken: vi.fn().mockResolvedValue('fcm-token'),
      onNotification: vi.fn((cb: (n: FcmNotification) => void) => { capturedCallback = cb; }),
      destroy: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent,
      dedup: new EventDeduplicator(),
      createReceiver: () => mockReceiver,
    });

    await listener.start();

    capturedCallback?.({
      data: {
        ding: { id: 'evt-99', kind: 'ding', created_at: '2026-01-01T10:00:00Z', doorbot_id: 'dev-1' },
        device: { id: 'dev-1', location_id: 'loc-1' },
      },
    });

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: 'evt-99',
      kind: 'ding',
      deviceId: 'dev-1',
    }));
  });

  it('does not emit duplicate events', async () => {
    const onEvent = vi.fn();
    let capturedCallback: ((notification: FcmNotification) => void) | undefined;

    const mockReceiver = {
      getToken: vi.fn().mockResolvedValue('fcm-token'),
      onNotification: vi.fn((cb: (n: FcmNotification) => void) => { capturedCallback = cb; }),
      destroy: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const listener = createFcmListener({
      accessToken: 'tok',
      hardwareId: 'hw',
      onEvent,
      dedup: new EventDeduplicator(),
      createReceiver: () => mockReceiver,
    });

    await listener.start();

    const notification = {
      data: {
        ding: { id: 'evt-dup', kind: 'ding', created_at: '2026-01-01T10:00:00Z', doorbot_id: 'dev-1' },
        device: { id: 'dev-1', location_id: 'loc-1' },
      },
    };

    capturedCallback?.(notification);
    capturedCallback?.(notification);  // same event again

    expect(onEvent).toHaveBeenCalledOnce();
  });
});
