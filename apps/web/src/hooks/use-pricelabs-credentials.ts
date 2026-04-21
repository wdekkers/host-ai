'use client';

import { useCallback, useState } from 'react';

export type ConnectResult =
  | { ok: true; fingerprint: string }
  | { ok: false; error: string };

export function useConnectPriceLabs(): {
  submit: (apiKey: string) => Promise<ConnectResult>;
  submitting: boolean;
} {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async (apiKey: string): Promise<ConnectResult> => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        fingerprint?: string;
        error?: string;
      };
      if (!res.ok) return { ok: false, error: body.error ?? 'Unknown error' };
      return { ok: true, fingerprint: body.fingerprint ?? '' };
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submit, submitting };
}

export function useDisconnectPriceLabs(): {
  disconnect: () => Promise<boolean>;
  submitting: boolean;
} {
  const [submitting, setSubmitting] = useState(false);
  const disconnect = useCallback(async (): Promise<boolean> => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/integrations/pricelabs/credentials', {
        method: 'DELETE',
      });
      return res.ok;
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { disconnect, submitting };
}
