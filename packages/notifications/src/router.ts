import type { SmsSender } from '@walt/sms';
import type { EmailSender } from '@walt/email';
import type { SlackClient } from '@walt/slack';

import type { Notification, NotificationPreference } from './types.js';

export type NotificationRouterDeps = {
  sms: SmsSender;
  email: EmailSender;
  slack: SlackClient;
  getPreferences: (orgId: string, category: string) => Promise<NotificationPreference | null>;
  getRecipientContact: (orgId: string, recipientId?: string) => Promise<{ phone?: string; email?: string }>;
  persistWebNotification: (notification: Notification) => Promise<void>;
};

export class NotificationRouter {
  private deps: NotificationRouterDeps;

  constructor(deps: NotificationRouterDeps) {
    this.deps = deps;
  }

  async send(notification: Notification): Promise<void> {
    const contact = await this.deps.getRecipientContact(
      notification.organizationId,
      notification.recipientId,
    );

    const sends: Promise<void>[] = [];

    for (const channel of notification.channels) {
      switch (channel) {
        case 'sms':
          if (contact.phone) {
            sends.push(
              this.deps.sms.send(contact.phone, `[Hostpilot] ${notification.title}: ${notification.body}`),
            );
          }
          break;
        case 'email':
          if (contact.email) {
            sends.push(
              this.deps.email.send({
                to: contact.email,
                subject: `[Hostpilot] ${notification.title}`,
                text: notification.body,
              }),
            );
          }
          break;
        case 'slack':
          sends.push(
            this.deps.slack.postMessage(notification.category, notification.body),
          );
          break;
        case 'web':
          sends.push(this.deps.persistWebNotification(notification));
          break;
      }
    }

    await Promise.allSettled(sends);
  }
}
