import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Email delivery.
 *
 * V1 ships a console transport: the message is printed to the server log.
 * That is enough to build and test every flow that depends on email without
 * an account, a domain, or a bill - and Phase 14 swaps in Brevo or Resend by
 * implementing `deliver` and nothing else.
 *
 * Every caller works the same way in both cases, so nothing above this class
 * has to know which transport is active.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService<Env, true>) { }

  async sendMagicLink(to: string, url: string): Promise<void> {
    await this.deliver({
      to,
      subject: 'Your sign-in link',
      body: [
        'Use the link below to sign in. It works once and expires shortly.',
        '',
        url,
        '',
        'If you did not ask to sign in, you can ignore this message.',
      ].join('\n'),
    });
  }

  async sendPasswordReset(to: string, url: string): Promise<void> {
    await this.deliver({
      to,
      subject: 'Reset your password',
      body: [
        'Use the link below to choose a new password. It works once and expires shortly.',
        '',
        url,
        '',
        'If you did not request this, you can ignore this message - your password is unchanged.',
      ].join('\n'),
    });
  }

  async sendInvitation(
    to: string,
    details: { familyName: string; invitedByName: string | null; note?: string; url: string },
  ): Promise<void> {
    const from = details.invitedByName ?? 'Someone';

    await this.deliver({
      to,
      subject: `${from} has added you to ${details.familyName}`,
      body: [
        `${from} is putting together a record of ${details.familyName} — who everyone is,`,
        'how they are related, and the stories worth keeping. They would like you in it.',
        ...(details.note ? ['', `They wrote: “${details.note}”`] : []),
        '',
        details.url,
        '',
        'The link works once and expires in a week.',
      ].join('\n'),
    });
  }

  private async deliver(message: OutboundEmail): Promise<void> {
    const transport = this.config.get('EMAIL_TRANSPORT', { infer: true });

    if (transport === 'console') {
      this.logger.log(
        [
          '',
          '-----------------------------------------------------------',
          `  EMAIL (console transport - not actually sent)`,
          `  To:      ${message.to}`,
          `  Subject: ${message.subject}`,
          '-----------------------------------------------------------',
          message.body,
          '-----------------------------------------------------------',
          '',
        ].join('\n'),
      );
      return Promise.resolve();
    }

    // Phase 14: HTTP call to Brevo or Resend goes here.
    throw new Error(`Email transport "${transport}" is not implemented yet.`);
  }
}