import { PriceLabsError } from './errors.js';

export interface HttpOptions {
  apiKey: string;
  baseUrl: string;
}

const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getJson<T>(path: string, opts: HttpOptions): Promise<T> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}${path}`;
  let lastError: unknown = null;

  // Backoff between retries: 200ms, 400ms. Attempt 2 (the 3rd) throws without sleeping.
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': opts.apiKey,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(200 * 2 ** attempt);
        continue;
      }
      throw new PriceLabsError('network_error', `fetch failed for ${path}`, err);
    }

    if (response.status === 401 || response.status === 403) {
      throw new PriceLabsError('auth_rejected', `PriceLabs rejected credentials (HTTP ${response.status})`);
    }
    if (response.status === 404) {
      throw new PriceLabsError('not_found', `Not found: ${path}`);
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(200 * 2 ** attempt);
        continue;
      }
      throw new PriceLabsError(
        response.status === 429 ? 'rate_limited' : 'server_error',
        `HTTP ${response.status} for ${path}`,
      );
    }
    if (!response.ok) {
      // 4xx (non-401/403/404) and any other unhandled status — treat as server_error for now.
      // If we start hitting specific codes in prod, add dedicated discriminators.
      throw new PriceLabsError('server_error', `Unexpected HTTP ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }

  throw new PriceLabsError('server_error', `Exhausted retries for ${path}`, lastError);
}
