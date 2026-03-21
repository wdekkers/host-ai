import { describe, it, expect, vi } from 'vitest';
import { generateHardwareId, fetchToken, refreshToken } from '../auth.js';
import { Requires2FAError, RingAuthError, RingTokenExpiredError } from '../errors.js';

describe('generateHardwareId', () => {
  it('returns a consistent UUID string for the same hostname', () => {
    const id1 = generateHardwareId('my-server');
    const id2 = generateHardwareId('my-server');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns different IDs for different hostnames', () => {
    const id1 = generateHardwareId('server-a');
    const id2 = generateHardwareId('server-b');
    expect(id1).not.toBe(id2);
  });
});

describe('fetchToken', () => {
  it('returns tokens on successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
      }), { status: 200 })
    ));

    const result = await fetchToken({
      email: 'a@b.com',
      password: 'pw',
      hardwareId: 'hw-123',
    });

    expect(result.access_token).toBe('acc');
    expect(result.refresh_token).toBe('ref');
    expect(result.hardware_id).toBe('hw-123');
  });

  it('throws Requires2FAError when 412 and no on2FA callback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 412 })
    ));
    await expect(
      fetchToken({ email: 'a@b.com', password: 'pw', hardwareId: 'hw' })
    ).rejects.toThrow(Requires2FAError);
  });

  it('retries with 2FA code when on2FA provided', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'acc2fa',
        refresh_token: 'ref2fa',
        expires_in: 3600,
      }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchToken({
      email: 'a@b.com',
      password: 'pw',
      hardwareId: 'hw',
      on2FA: async () => '012345',  // leading zero — must stay as string
    });

    expect(result.access_token).toBe('acc2fa');
    const secondCall = mockFetch.mock.calls[1] as [string, RequestInit];
    expect((secondCall[1].headers as Record<string, string>)['2fa-code']).toBe('012345');
  });

  it('throws RingAuthError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(
      fetchToken({ email: 'a@b.com', password: 'pw', hardwareId: 'hw' })
    ).rejects.toThrow(RingAuthError);
  });
});

describe('refreshToken', () => {
  it('returns new tokens on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'new-acc',
        refresh_token: 'new-ref',
        expires_in: 3600,
      }), { status: 200 })
    ));
    const result = await refreshToken({ refreshTokenValue: 'old-ref', hardwareId: 'hw' });
    expect(result.access_token).toBe('new-acc');
    expect(result.hardware_id).toBe('hw');
  });

  it('throws RingTokenExpiredError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(
      refreshToken({ refreshTokenValue: 'bad', hardwareId: 'hw' })
    ).rejects.toThrow(RingTokenExpiredError);
  });
});
