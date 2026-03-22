import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import {
  RING_OAUTH_URL,
  RING_CLIENT_ID,
  RING_USER_AGENT,
  HARDWARE_ID_NAMESPACE,
} from './const.js';
import { RingAuthError, Requires2FAError, RingTokenExpiredError } from './errors.js';

export interface RingTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  hardware_id: string;
}

interface FetchTokenOptions {
  email: string;
  password: string;
  hardwareId: string;
  on2FA?: () => Promise<string>;
  otpCode?: string;
}

/**
 * Generates a stable hardware ID for this machine.
 * Deterministic per machine (hostname), different across machines.
 * Pass machineId for testing; defaults to os.hostname().
 */
export function generateHardwareId(machineId = hostname()): string {
  const raw = `${HARDWARE_ID_NAMESPACE}:${RING_USER_AGENT}:${machineId}`;
  const hash = createHash('sha1').update(raw).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '5' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

export async function fetchToken(options: FetchTokenOptions): Promise<RingTokens> {
  const { email, password, hardwareId, on2FA, otpCode } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': RING_USER_AGENT,
    hardware_id: hardwareId,
    Authorization: `Basic ${btoa(`${RING_CLIENT_ID}:`)}`,
  };

  if (otpCode) {
    headers['2fa-support'] = 'true';
    headers['2fa-code'] = otpCode;  // must remain string — OTPs can have leading zeros
  }

  const body = new URLSearchParams({
    client_id: RING_CLIENT_ID,
    grant_type: 'password',
    username: email,
    password,
    scope: 'client',
    include_client_id: 'true',
  });

  const response = await fetch(RING_OAUTH_URL, { method: 'POST', headers, body });

  if (response.status === 412) {
    if (!on2FA) throw new Requires2FAError();
    const code = await on2FA();
    return fetchToken({ ...options, otpCode: code });
  }

  if (response.status === 401) throw new RingAuthError();
  if (!response.ok) throw new RingAuthError(`Unexpected status: ${response.status}`);

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return { ...data, hardware_id: hardwareId };
}

export async function refreshToken(options: {
  refreshTokenValue: string;
  hardwareId: string;
}): Promise<RingTokens> {
  const { refreshTokenValue, hardwareId } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': RING_USER_AGENT,
    hardware_id: hardwareId,
    Authorization: `Basic ${btoa(`${RING_CLIENT_ID}:`)}`,
  };

  const body = new URLSearchParams({
    client_id: RING_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  });

  const response = await fetch(RING_OAUTH_URL, { method: 'POST', headers, body });

  if (response.status === 401) throw new RingTokenExpiredError();
  if (!response.ok) throw new RingTokenExpiredError(`Refresh failed: ${response.status}`);

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return { ...data, hardware_id: hardwareId };
}
