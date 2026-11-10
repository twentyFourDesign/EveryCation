import { Injectable, Logger } from '@nestjs/common';

/** Sends text messages. Swap the provider for Termii or Africa's Talking in production. */
export abstract class SmsSender {
  abstract send(to: string, message: string): Promise<void>;
}

/** Development sender: writes the message to the log instead of sending it. */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly log = new Logger('SMS');
  async send(to: string, message: string) { this.log.log(`to ${to}: ${message}`); }
}
