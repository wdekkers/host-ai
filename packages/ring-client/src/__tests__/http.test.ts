import { describe, it, expect, vi } from 'vitest';
import { createHttpClient } from '../http.js';

describe('createHttpClient', () => {
  it('injects Authorization and hardware_id headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const http = createHttpClient({
      getTokens: async () => ({ accessToken: 'test-token', hardwareId: 'hw-123' }),
      onTokenRefresh: vi.fn(),
    });
    await http.get('/some/path');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/some/path'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          hardware_id: 'hw-123',
        }),
      })
    );
  });

  it('calls onTokenRefresh and retries on 401', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const onTokenRefresh = vi.fn().mockResolvedValue(undefined);
    const getTokens = vi.fn()
      .mockResolvedValueOnce({ accessToken: 'old-token', hardwareId: 'hw' })
      .mockResolvedValueOnce({ accessToken: 'new-token', hardwareId: 'hw' });

    const http = createHttpClient({ getTokens, onTokenRefresh });
    await http.get('/path');

    expect(onTokenRefresh).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondCall = mockFetch.mock.calls[1] as [string, RequestInit];
    expect((secondCall[1].headers as Record<string, string>)['Authorization']).toBe('Bearer new-token');
  });

  it('throws RingNetworkError on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
    const http = createHttpClient({
      getTokens: async () => ({ accessToken: 'tok', hardwareId: 'hw' }),
      onTokenRefresh: vi.fn(),
    });
    await expect(http.get('/path')).rejects.toThrow('RingNetworkError');
  });
});
