import { RING_API_BASE, RING_USER_AGENT, RING_API_VERSION } from './const.js';
import { RingNetworkError } from './errors.js';

interface TokenInfo {
  accessToken: string;
  hardwareId: string;
}

interface HttpClientOptions {
  getTokens: () => Promise<TokenInfo>;
  onTokenRefresh: () => Promise<void>;
}

export interface HttpClient {
  get: <T>(path: string, params?: Record<string, string>) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const { getTokens, onTokenRefresh } = options;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    isRetry = false
  ): Promise<T> {
    const { accessToken, hardwareId } = await getTokens();
    const url = new URL(`${RING_API_BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': RING_USER_AGENT,
      hardware_id: hardwareId,
      'X-API-LANG': 'en',
      'X-API-TIMEZONE': 'UTC',
      'X-API-VERSION': RING_API_VERSION,
    };
    if (body) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new RingNetworkError(`RingNetworkError: fetch failed (${String(err)})`);
    }

    // On first 401, refresh token and retry once
    if (response.status === 401 && !isRetry) {
      await onTokenRefresh();
      return request<T>(method, path, body, params, true);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) =>
      request<T>('GET', path, undefined, params),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  };
}
