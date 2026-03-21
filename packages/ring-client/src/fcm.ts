import { RING_API_BASE, FCM_SENDER_ID, FCM_APP_ID, FCM_PROJECT_ID, FCM_API_KEY } from './const.js';
import type { EventCallback, EventDeduplicator, RingEvent } from './events.js';

export type FcmStatus = 'connected' | 'degraded' | 'stopped';

export interface FcmNotification {
  data?: FcmPushData;
}

interface FcmReceiver {
  getToken: () => Promise<string>;
  onNotification: (callback: (notification: FcmNotification) => void) => void;
  destroy?: () => void;
}

interface FcmPushData {
  ding?: {
    id?: string;
    kind?: string;
    created_at?: string;
    answered?: boolean;
    doorbot_id?: string;
  };
  device?: { id?: string; location_id?: string };
  action?: string;
}

interface FcmListenerOptions {
  accessToken: string;
  hardwareId: string;
  onEvent: EventCallback;
  dedup: EventDeduplicator;
  /** Injectable factory for testing. Defaults to creating a real PushReceiver. */
  createReceiver?: () => FcmReceiver | Promise<FcmReceiver>;
}

export interface FcmListener {
  start: () => Promise<void>;
  stop: () => void;
  getStatus: () => FcmStatus;
}

async function defaultCreateReceiver(): Promise<FcmReceiver> {
  const { PushReceiver } = await import('@eneris/push-receiver');
  const client = new PushReceiver({
    firebase: {
      projectId: FCM_PROJECT_ID,
      appId: FCM_APP_ID,
      apiKey: FCM_API_KEY,
      messagingSenderId: FCM_SENDER_ID,
    },
  });

  return {
    async getToken() {
      await client.connect();
      return client.fcmToken;
    },
    onNotification(callback: (notification: FcmNotification) => void) {
      client.onNotification((envelope) => {
        callback({ data: envelope.message.data as FcmPushData | undefined });
      });
    },
    destroy() {
      client.destroy();
    },
  };
}

function parseEvent(data: FcmPushData, dedup: EventDeduplicator): RingEvent | null {
  const ding = data.ding;
  if (!ding?.id) return null;
  const id = String(ding.id);
  if (!dedup.isNew(id)) return null;

  const kind: RingEvent['kind'] =
    ding.kind === 'motion' ? 'motion'
    : data.action === 'intercom_unlock' ? 'intercom_unlock'
    : 'ding';

  return {
    id,
    deviceId: String(ding.doorbot_id ?? data.device?.id ?? ''),
    locationId: String(data.device?.location_id ?? ''),
    kind,
    timestamp: ding.created_at ? new Date(ding.created_at) : new Date(),
    ...(ding.answered !== undefined ? { answered: ding.answered } : {}),
  };
}

export function createFcmListener(options: FcmListenerOptions): FcmListener {
  const { accessToken, hardwareId, onEvent, dedup, createReceiver } = options;
  let status: FcmStatus = 'stopped';
  let receiver: FcmReceiver | null = null;

  return {
    async start() {
      try {
        receiver = await (createReceiver ?? defaultCreateReceiver)();
        const fcmToken = await receiver.getToken();

        // Register FCM token with Ring
        const regResponse = await fetch(`${RING_API_BASE}/device`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            hardware_id: hardwareId,
          },
          body: JSON.stringify({
            device: {
              metadata: {
                api_version: '11',
                device_model: 'ring-client-node',
                pn_service: 'fcm',
                pn_token: fcmToken,
              },
            },
          }),
        });
        if (!regResponse.ok) {
          throw new Error(`FCM registration failed: HTTP ${regResponse.status}`);
        }

        receiver.onNotification((notification) => {
          if (!notification.data) return;
          const event = parseEvent(notification.data, dedup);
          if (event) onEvent(event);
        });

        status = 'connected';
      } catch {
        // Degrade gracefully — poller continues as sole event source
        status = 'degraded';
      }
    },

    stop() {
      receiver?.destroy?.();
      receiver = null;
      status = 'stopped';
    },

    getStatus() {
      return status;
    },
  };
}
