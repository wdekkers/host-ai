import { NextResponse } from 'next/server';

const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 500;
const SENSITIVE_KEY_PATTERNS = [
  'token',
  'secret',
  'password',
  'authorization',
  'api_key',
  'apikey',
];
const EMAIL_KEY_PATTERNS = ['email'];
const PHONE_KEY_PATTERNS = ['phone', 'mobile', 'whatsapp', 'contact'];

function truncateString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

function maskEmail(value: string) {
  return value.replace(
    /([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    (_match, localPart: string, domain: string) => {
      const head = localPart.slice(0, 1);
      return `${head}***@${domain.toLowerCase()}`;
    },
  );
}

function maskPhone(value: string) {
  return value.replace(/\+?\d[\d\s().-]{7,}\d/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 8) {
      return match;
    }
    const start = digits.slice(0, 2);
    const end = digits.slice(-2);
    return `[PHONE:${start}${'*'.repeat(Math.max(0, digits.length - 4))}${end}]`;
  });
}

function maskText(value: string) {
  return maskPhone(maskEmail(truncateString(value)));
}

function keyLooksSensitive(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function keyLooksEmail(key: string) {
  const normalized = key.toLowerCase();
  return EMAIL_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function keyLooksPhone(key: string) {
  const normalized = key.toLowerCase();
  return PHONE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function redactForLogs(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return '[MAX_DEPTH]';
  }

  if (typeof value === 'string') {
    return maskText(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactForLogs(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const redactedEntries = Object.entries(record).map(([key, entry]) => {
      if (keyLooksSensitive(key)) {
        return [key, '[REDACTED]'] as const;
      }
      if (keyLooksEmail(key) && typeof entry === 'string') {
        return [key, maskEmail(entry)] as const;
      }
      if (keyLooksPhone(key) && typeof entry === 'string') {
        return [key, maskPhone(entry)] as const;
      }
      return [key, redactForLogs(entry, depth + 1)] as const;
    });
    return Object.fromEntries(redactedEntries);
  }

  return String(value);
}

export function log(level: 'info' | 'warn', event: string, data?: Record<string, unknown>): void {
  const payload = {
    level,
    event,
    ...(redactForLogs(data ?? {}) as Record<string, unknown>),
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
}

type ApiErrorInput = {
  route: string;
  error: unknown;
  status?: number;
  context?: Record<string, unknown>;
};

export function handleApiError(input: ApiErrorInput) {
  const status = input.status ?? 400;
  const message = input.error instanceof Error ? input.error.message : 'Invalid request';
  const safeMessage = typeof message === 'string' ? maskText(message) : 'Invalid request';

  const payload = {
    level: 'error',
    event: 'api_error',
    route: input.route,
    status,
    message: safeMessage,
    context: redactForLogs(input.context ?? {}),
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));

  return NextResponse.json({ error: safeMessage }, { status });
}
