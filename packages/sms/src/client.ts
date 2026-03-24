export interface SmsSender {
  send(to: string, body: string): Promise<void>;
}

type TwilioClient = {
  messages: {
    create(params: { to: string; from: string; body: string }): Promise<{ sid: string }>;
  };
};

export class TwilioSmsSender implements SmsSender {
  private client: TwilioClient;
  private fromNumber: string;

  constructor(opts: { client: TwilioClient; fromNumber: string }) {
    this.client = opts.client;
    this.fromNumber = opts.fromNumber;
  }

  async send(to: string, body: string): Promise<void> {
    await this.client.messages.create({ to, from: this.fromNumber, body });
  }
}
