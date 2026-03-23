import { getHospitableApiConfig } from '@/lib/integrations-env';

export type SendResult = {
  success: boolean;
  platformMessageId?: string;
  error?: string;
};

type SendInput = {
  conversationId: string;
  body: string;
};

type SendDeps = {
  fetch?: typeof globalThis.fetch;
  apiKey?: string;
  baseUrl?: string;
};

export async function sendViaHospitable(
  input: SendInput,
  deps: SendDeps = {},
): Promise<SendResult> {
  const config = deps.apiKey && deps.baseUrl
    ? { apiKey: deps.apiKey, baseUrl: deps.baseUrl }
    : getHospitableApiConfig();

  if (!config) {
    return { success: false, error: 'Hospitable API not configured' };
  }

  const fetchFn = deps.fetch ?? globalThis.fetch;
  const url = new URL(
    `/v2/conversations/${input.conversationId}/messages`,
    config.baseUrl,
  );

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ body: input.body }),
    });
  } catch (err) {
    return {
      success: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `Hospitable API returned ${response.status}`,
    };
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    success: true,
    platformMessageId: typeof data.id === 'string' ? data.id : undefined,
  };
}
