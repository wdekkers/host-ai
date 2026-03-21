import { describe, it, expect, vi } from 'vitest';
import { RingClient } from '../client.js';

describe('RingClient', () => {
  it('calls onTokenUpdate after successful auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
      }), { status: 200 })
    ));

    const onTokenUpdate = vi.fn();
    const client = new RingClient({ email: 'a@b.com', password: 'pw', onTokenUpdate });
    await client.auth({});

    expect(onTokenUpdate).toHaveBeenCalledWith(expect.objectContaining({
      access_token: 'acc',
      hardware_id: expect.any(String),
    }));
  });

  it('skips fetch when savedTokens provided', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const client = new RingClient({
      email: 'a@b.com',
      password: 'pw',
      savedTokens: {
        access_token: 'saved',
        refresh_token: 'ref',
        expires_in: 3600,
        hardware_id: 'hw-123',
      },
    });
    await client.auth({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getStatus returns not_started before startListening', () => {
    const client = new RingClient({ email: 'a@b.com', password: 'pw' });
    const status = client.getStatus();
    expect(status.fcm).toBe('not_started');
    expect(status.polling).toBe('stopped');
  });
});
