import { createPublicKey, verify as verifySignature } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  sub?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  org_id?: string;
  org_role?: string;
  permissions?: string[];
};

type Jwk = {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type JwksResponse = {
  keys: Jwk[];
};

export type AuthContext = {
  userId: string;
  orgId: string | null;
  role: string;
  permissions: string[];
};

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

const MAX_JWKS_AGE_MS = 5 * 60 * 1000;

const decodeBase64Url = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const loadJwks = (() => {
  let cached: { keys: Jwk[]; loadedAt: number } | null = null;

  return async (jwksUrl: string): Promise<Jwk[]> => {
    if (cached && Date.now() - cached.loadedAt < MAX_JWKS_AGE_MS) {
      return cached.keys;
    }

    const response = await fetch(jwksUrl, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load JWKS: ${response.status}`);
    }

    const payload = parseJson<JwksResponse>(await response.text());
    if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
      throw new Error('JWKS response did not include keys');
    }

    cached = { keys: payload.keys, loadedAt: Date.now() };
    return payload.keys;
  };
})();

async function verifyJwt(token: string, issuer: string, jwksUrl: string): Promise<JwtPayload> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Invalid JWT format');
  }

  const header = parseJson<JwtHeader>(decodeBase64Url(encodedHeader).toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported JWT signing algorithm');
  }

  const payload = parseJson<JwtPayload>(decodeBase64Url(encodedPayload).toString('utf8'));
  if (payload.iss !== issuer) {
    throw new Error('Invalid JWT issuer');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now >= payload.exp) {
    throw new Error('JWT has expired');
  }
  if (typeof payload.nbf === 'number' && now < payload.nbf) {
    throw new Error('JWT is not active yet');
  }

  const keys = await loadJwks(jwksUrl);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    throw new Error('JWT signing key not found');
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const valid = verifySignature('RSA-SHA256', signingInput, publicKey, signature);
  if (!valid) {
    throw new Error('JWT signature is invalid');
  }

  return payload;
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, value] = header.split(' ');
  if (!scheme || !value || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return value;
}

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  request.auth = null;

  if (request.url === '/health') {
    return;
  }

  const issuer = process.env.CLERK_JWT_ISSUER;
  const jwksUrl = process.env.CLERK_JWKS_URL;

  if (!issuer || !jwksUrl) {
    reply.code(500);
    throw new Error('Missing CLERK_JWT_ISSUER or CLERK_JWKS_URL configuration');
  }

  const token = getBearerToken(request);
  if (!token) {
    reply.code(401);
    throw new Error('Missing bearer token');
  }

  const payload = await verifyJwt(token, issuer, jwksUrl);
  if (!payload.sub) {
    reply.code(401);
    throw new Error('JWT subject is missing');
  }

  request.auth = {
    userId: payload.sub,
    orgId: payload.org_id ?? null,
    role: payload.org_role ?? 'viewer',
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}
