const ZODIAC_BASE = 'https://prod.zodiac-io.com';
// Public API key shared by all iAqualink integrations — not a secret, hardcoded intentionally.
const IAQUALINK_API_KEY = 'EOOEMOW4YR6QNB07';

/** A minimal fetch-compatible signature that accepts string URLs. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

let cachedToken: string | null = null;

export interface PoolReading {
  deviceSerial: string;
  temperatureF: number | null; // null = pump off or temperature unavailable
  polledAt: Date;
}

async function authenticate(fetchFn: FetchFn): Promise<string> {
  const res = await fetchFn(`${ZODIAC_BASE}/users/v1/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.IAQUALINK_USERNAME,
      password: process.env.IAQUALINK_PASSWORD,
      apiKey: IAQUALINK_API_KEY,
    }),
  });
  if (!res.ok) throw new Error(`iAqualink auth failed: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  // The devices/v2 shadow endpoint requires the Cognito IdToken (userPoolOAuth.IdToken).
  // Older API versions used authentication_token (Ruby session) or a top-level id_token.
  const token =
    ((data.userPoolOAuth as Record<string, unknown> | undefined)?.IdToken as string | undefined) ??
    (data.id_token as string | undefined) ??
    (data.authentication_token as string | undefined);
  if (!token) {
    throw new Error(`iAqualink auth: no token found. Response fields: ${Object.keys(data).join(', ')}`);
  }
  cachedToken = token;
  return token;
}

export async function readTemperature(
  deviceSerial: string,
  deps: { fetchFn?: FetchFn } = {},
): Promise<PoolReading> {
  const fetchFn = deps.fetchFn ?? (fetch as FetchFn);
  const token = cachedToken ?? (await authenticate(fetchFn));

  const doRequest = (authToken: string) =>
    fetchFn(`${ZODIAC_BASE}/devices/v2/${deviceSerial}/shadow`, {
      headers: { authorization: `Bearer ${authToken}` },
    });

  let res = await doRequest(token);
  if (res.status === 401) {
    cachedToken = null;
    const newToken = await authenticate(fetchFn);
    res = await doRequest(newToken);
  }
  if (!res.ok) throw new Error(`iAqualink shadow fetch failed: ${res.status}`);

  const body = (await res.json()) as Record<string, unknown>;

  // NOTE: Confirm the exact path by logging `body` on the first live call.
  // Known paths from reverse engineering:
  //   body.reported.state.pool_temp  (most common)
  //   body.reported.pool_temp        (older firmware)
  const reported = (body.reported ?? body) as Record<string, unknown>;
  const state = (reported.state ?? reported) as Record<string, unknown>;
  const rawTemp = state.pool_temp ?? reported.pool_temp;
  const temperatureF = typeof rawTemp === 'number' ? rawTemp : null;

  return { deviceSerial, temperatureF, polledAt: new Date() };
}

/** Clears the in-process token cache. Exposed for testing. */
export function clearTokenCache(): void {
  cachedToken = null;
}
