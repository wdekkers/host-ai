export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

type ResendClient = {
  emails: {
    send(params: Record<string, unknown>): Promise<{ id: string }>;
  };
};

export class ResendEmailSender implements EmailSender {
  private client: ResendClient;
  private fromAddress: string;

  constructor(opts: { client: ResendClient; fromAddress: string }) {
    this.client = opts.client;
    this.fromAddress = opts.fromAddress;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.emails.send({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
