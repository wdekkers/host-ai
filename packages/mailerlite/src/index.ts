export type MailerLiteSubscribeInput = {
  apiKey: string;
  groupId: string;
  email: string;
  source?: string;
  fields?: Record<string, string | number | boolean | null>;
};

export type MailerLiteSubscribeResult = {
  ok: boolean;
  status: number;
  message?: string;
};

const MAILERLITE_ENDPOINT = "https://connect.mailerlite.com/api/subscribers";

export async function subscribeToMailerLite(
  input: MailerLiteSubscribeInput,
): Promise<MailerLiteSubscribeResult> {
  const { apiKey, groupId, email, source, fields } = input;

  if (!apiKey || !groupId || !email) {
    return { ok: false, status: 400, message: "Missing required fields." };
  }

  const response = await fetch(MAILERLITE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      groups: [groupId],
      fields: {
        ...(source ? { source } : {}),
        ...(fields ?? {}),
      },
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      ok: false,
      status: response.status,
      message: errorBody?.message ?? "Unable to subscribe.",
    };
  }

  return { ok: true, status: response.status };
}
