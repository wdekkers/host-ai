import aws4 from 'aws4';

const ZODIAC_BASE = 'https://prod.zodiac-io.com';
// Public API key shared by all iAqualink integrations — not a secret, hardcoded intentionally.
const IAQUALINK_API_KEY = 'EOOEMOW4YR6QNB07';

/** A minimal fetch-compatible signature that accepts string URLs. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

type AuthSession = {
  credentials: AwsCredentials;
};

let cachedSession: AuthSession | null = null;

export interface PoolReading {
  deviceSerial: string;
  temperatureF: number | null; // null = pump off or temperature unavailable
  polledAt: Date;
}

async function authenticate(fetchFn: FetchFn): Promise<AuthSession> {
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
  const creds = data.credentials as Record<string, string> | undefined;
  if (!creds?.AccessKeyId || !creds?.SecretKey || !creds?.SessionToken) {
    throw new Error(`iAqualink auth: no AWS credentials in response. Fields: ${Object.keys(data).join(', ')}`);
  }
  const session: AuthSession = {
    credentials: {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretKey,
      sessionToken: creds.SessionToken,
    },
  };
  cachedSession = session;
  return session;
}

function signedShadowRequest(deviceSerial: string, creds: AwsCredentials): RequestInit & { url: string } {
  const host = 'prod.zodiac-io.com';
  const path = `/devices/v2/${deviceSerial}/shadow`;
  const signed = aws4.sign(
    {
      host,
      path,
      service: 'execute-api',
      region: 'us-east-1',
    },
    {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  );
  // Remove 'Host' — fetch sets it from the URL; Node.js fetch (undici) treats it
  // as a restricted header and may silently drop an explicit value, which would not
  // affect the signature (the server derives Host from the URL the same way).
  const allHeaders = signed.headers as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { Host: _host, ...headers } = allHeaders;
  return {
    url: `https://${host}${path}`,
    headers,
  };
}

export async function readTemperature(
  deviceSerial: string,
  deps: { fetchFn?: FetchFn } = {},
): Promise<PoolReading> {
  const fetchFn = deps.fetchFn ?? (fetch as FetchFn);
  const session = cachedSession ?? (await authenticate(fetchFn));

  const doRequest = (s: AuthSession) => {
    const { url, ...init } = signedShadowRequest(deviceSerial, s.credentials);
    return fetchFn(url, init);
  };

  let res = await doRequest(session);
  if (res.status === 401 || res.status === 403) {
    cachedSession = null;
    const newSession = await authenticate(fetchFn);
    res = await doRequest(newSession);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`iAqualink shadow fetch failed: ${res.status} ${errBody}`);
  }

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

/** Clears the in-process session cache. Exposed for testing. */
export function clearSessionCache(): void {
  cachedSession = null;
}
