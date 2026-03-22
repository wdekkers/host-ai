import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

type SendSesEmailOptions = {
  region: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

type SendSesEmailResult = {
  ok: boolean;
  messageId?: string;
  requestId?: string;
  error?: string;
};

export async function sendSesEmail({
  region,
  from,
  to,
  subject,
  text,
  html,
  replyTo,
}: SendSesEmailOptions): Promise<SendSesEmailResult> {
  const client = new SESClient({ region });
  const command = new SendEmailCommand({
    Destination: { ToAddresses: to },
    Source: from,
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Message: {
      Subject: { Data: subject },
      Body: {
        Text: { Data: text },
        ...(html ? { Html: { Data: html } } : {}),
      },
    },
  });

  try {
    const response = await client.send(command);
    return {
      ok: true,
      messageId: response.MessageId,
      requestId: response.$metadata?.requestId,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
