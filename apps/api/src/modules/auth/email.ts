import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/errors.js';
import { createTransport, type Transporter } from 'nodemailer';
import { CONFIG, type Config } from '../../config.js';

export interface Email { to: string; subject: string; text: string; html: string }

/** Sends email. Any provider with SMTP works (Resend, Postmark, Amazon SES, Zoho, Google Workspace…): set SMTP_URL. */
export abstract class EmailSender {
  abstract send(email: Email): Promise<void>;
}

/** Used when SMTP_URL is not set: writes the message to the log instead of sending it. */
@Injectable()
export class ConsoleEmailSender extends EmailSender {
  private readonly log = new Logger('Email');
  async send(email: Email) { this.log.log(`to ${email.to}: ${email.subject}\n${email.text}`); }
}

@Injectable()
export class SmtpEmailSender extends EmailSender {
  private readonly transport: Transporter;
  private readonly log = new Logger('Email');
  constructor(@Inject(CONFIG) private readonly config: Config) { super(); this.transport = createTransport(config.SMTP_URL!, { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 }); }
  /** Logs where each email went, never its contents (they hold sign-in codes). */
  async send(email: Email) {
    const to = email.to.replace(/^(.).*(@.*)$/, '$1***$2');
    try {
      const r = await this.transport.sendMail({ from: this.config.MAIL_FROM, ...email });
      this.log.log(`Sent to ${to} (${r.response ?? 'accepted'})`);
    } catch (e) {
      this.log.error(`Could not send to ${to}: ${(e as Error).message}`);
      throw new EmailFailed();
    }
  }
}

/** Sending failed; the traveller is told to try again rather than shown a server error. */
export class EmailFailed extends AppError {
  constructor() { super(503, 'email_failed', 'We could not send your code just now. Please try again in a minute.'); }
}

/** The sign-in code email. Plain, quick to read on a phone, and the code is in the subject so it shows in the notification. */
export function codeEmail(to: string, code: string, minutes: number): Email {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    to, subject: `${code} is your EveryCation code`,
    text: `Your EveryCation code is ${code}.\n\nIt expires in ${minutes} minutes. Never share it with anyone. EveryCation staff will never ask for it.\n\nIf you did not ask for this code, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#F2F4F8;font-family:Helvetica,Arial,sans-serif;color:#0B1533">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:18px"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#002C82">EveryCation</p>
<p style="margin:0 0 8px;font-size:15px">Your sign-in code is</p>
<p style="margin:0 0 20px;font-size:34px;font-weight:700;letter-spacing:4px;color:#002C82">${spaced}</p>
<p style="margin:0 0 8px;font-size:14px;line-height:21px">It expires in ${minutes} minutes. Never share it with anyone. EveryCation staff will never ask for it.</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#5B6478">If you did not ask for this code, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
