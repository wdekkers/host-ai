import { generateHardwareId, fetchToken, refreshToken, type RingTokens } from './auth.js';
import { createHttpClient, type HttpClient } from './http.js';
import {
  parseRingDevices,
  groupDevicesByLocation,
  mergeLocationNames,
  type RingLocation,
  type RingDevicesResponse,
  type RawLocationEntry,
} from './devices.js';
import { EventDeduplicator, type EventCallback, type ErrorCallback } from './events.js';
import { createPoller, type Poller } from './poller.js';
import { createFcmListener, type FcmListener, type FcmStatus } from './fcm.js';

export interface RingClientOptions {
  email: string;
  password: string;
  savedTokens?: RingTokens;
  onTokenUpdate?: (tokens: RingTokens) => void;
}

export interface ClientStatus {
  fcm: FcmStatus | 'not_started';
  polling: 'active' | 'stopped';
}

export class RingClient {
  private tokens: RingTokens | null;
  private readonly options: RingClientOptions;
  private eventCallbacks: EventCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private poller: Poller | null = null;
  private fcmListener: FcmListener | null = null;
  private pollingActive = false;

  constructor(options: RingClientOptions) {
    this.options = options;
    this.tokens = options.savedTokens ?? null;
  }

  async auth(opts: { on2FA?: () => Promise<string> }): Promise<void> {
    if (this.tokens) return;

    const hardwareId = generateHardwareId();
    this.tokens = await fetchToken({
      email: this.options.email,
      password: this.options.password,
      hardwareId,
      on2FA: opts.on2FA,
    });

    this.options.onTokenUpdate?.(this.tokens);
  }

  private getHttp(): HttpClient {
    if (!this.tokens) throw new Error('Call auth() before using the client');

    return createHttpClient({
      getTokens: async () => ({
        accessToken: this.tokens!.access_token,
        hardwareId: this.tokens!.hardware_id,
      }),
      onTokenRefresh: async () => {
        const current = this.tokens;
        if (!current) throw new Error('Token lost before refresh could complete');
        const newTokens = await refreshToken({
          refreshTokenValue: current.refresh_token,
          hardwareId: current.hardware_id,
        });
        this.tokens = newTokens;
        this.options.onTokenUpdate?.(newTokens);
      },
    });
  }

  async getLocations(): Promise<RingLocation[]> {
    const http = this.getHttp();
    const [devicesResponse, locationsResponse] = await Promise.all([
      http.get<RingDevicesResponse>('/ring_devices'),
      http.get<{ user_locations: RawLocationEntry[] }>('/locations').catch(() => ({ user_locations: [] })),
    ]);

    const devices = parseRingDevices(devicesResponse);
    const groups = groupDevicesByLocation(devices);
    return mergeLocationNames(groups, locationsResponse.user_locations);
  }

  async getHistory(deviceId: string, opts: { limit?: number } = {}): Promise<unknown[]> {
    const http = this.getHttp();
    return http.get<unknown[]>('/doorbots/history', {
      doorbot_id: deviceId,
      limit: String(opts.limit ?? 20),
    });
  }

  async getSnapshot(deviceId: string): Promise<Buffer> {
    if (!this.tokens) throw new Error('Call auth() before using the client');
    const response = await fetch(
      `https://api.ring.com/clients_api/snapshots/image/${deviceId}`,
      {
        headers: {
          Authorization: `Bearer ${this.tokens.access_token}`,
          hardware_id: this.tokens.hardware_id,
        },
      }
    );
    if (!response.ok) throw new Error(`Snapshot fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }

  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  private emit(event: Parameters<EventCallback>[0]): void {
    for (const cb of this.eventCallbacks) cb(event);
  }

  private emitError(error: Error): void {
    for (const cb of this.errorCallbacks) cb(error);
  }

  async startListening(): Promise<void> {
    if (!this.tokens) throw new Error('Call auth() before startListening()');
    if (this.pollingActive) throw new Error('Already listening — call disconnect() first');

    const locations = await this.getLocations();
    const devices = locations.flatMap(l => l.devices);
    const http = this.getHttp();
    const dedup = new EventDeduplicator();

    this.poller = createPoller({
      devices,
      get: http.get.bind(http),
      dedup,
      onEvent: this.emit.bind(this),
    });

    this.fcmListener = createFcmListener({
      accessToken: this.tokens.access_token,
      hardwareId: this.tokens.hardware_id,
      onEvent: this.emit.bind(this),
      dedup,
    });

    await this.fcmListener.start();
    if (this.fcmListener.getStatus() === 'degraded') {
      this.emitError(new Error('FCM registration failed — operating in polling-only mode'));
    }
    this.poller.start();
    this.pollingActive = true;
  }

  async disconnect(): Promise<void> {
    this.poller?.stop();
    this.fcmListener?.stop();
    this.pollingActive = false;
  }

  getStatus(): ClientStatus {
    return {
      fcm: this.fcmListener?.getStatus() ?? 'not_started',
      polling: this.pollingActive ? 'active' : 'stopped',
    };
  }
}
