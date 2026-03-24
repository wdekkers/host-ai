type SlackResponse = { ok: boolean; error?: string };

export class SlackClient {
  private token: string;
  private fetch: typeof globalThis.fetch;

  constructor(opts: { token: string; fetch?: typeof globalThis.fetch }) {
    this.token = opts.token;
    this.fetch = opts.fetch ?? globalThis.fetch;
  }

  async postMessage(channel: string, text: string): Promise<void> {
    const response = await this.fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });

    const data = (await response.json()) as SlackResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error ?? 'unknown'}`);
    }
  }
}
