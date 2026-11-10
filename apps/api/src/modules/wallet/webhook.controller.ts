import { Controller, Headers, HttpCode, Inject, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Public } from '../../common/auth.guard.js';
import { AppError, unauthorized } from '../../common/errors.js';
import { CONFIG, type Config } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { webhookEvents } from '../../db/schema.js';
import { WalletService } from './wallet.service.js';

const event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('deposit.received'), eventId: z.string().min(4), userId: z.uuid(), amount: z.number().int().positive(), reference: z.string().min(4), goalId: z.uuid().optional(), channel: z.enum(['transfer', 'card']).default('transfer') }),
  z.object({ type: z.literal('transfer.settled'), eventId: z.string().min(4), reference: z.string() }),
  z.object({ type: z.literal('transfer.failed'), eventId: z.string().min(4), reference: z.string() }),
]);

export const signPayload = (secret: string, raw: Buffer | string) => createHmac('sha256', secret).update(raw).digest('hex');

/**
 * Receives events from the wallet partner. The payload shape here is ours; when a partner is
 * chosen, map their events to it in this file. Every call must carry a valid HMAC signature.
 */
@ApiExcludeController() @SkipThrottle()
@Controller('webhooks/partner')
export class PartnerWebhookController {
  constructor(private readonly wallet: WalletService, private readonly database: Database, @Inject(CONFIG) private readonly config: Config) {}

  @Public() @HttpCode(200)
  @Post()
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-signature') signature?: string) {
    const raw = req.rawBody;
    const expected = raw ? Buffer.from(signPayload(this.config.PARTNER_WEBHOOK_SECRET, raw)) : null;
    const given = Buffer.from(signature ?? '');
    if (!expected || given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized('bad_signature', 'Signature check failed.');

    const parsed = event.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'invalid_event', 'Unrecognised event.');
    const e = parsed.data;
    const seen = await this.database.db.insert(webhookEvents).values({ provider: 'partner', eventId: e.eventId, payload: e }).onConflictDoNothing().returning({ id: webhookEvents.id });
    if (seen.length === 0) return { received: true, duplicate: true };

    if (e.type === 'deposit.received') await this.wallet.creditDeposit({ userId: e.userId, amount: e.amount, partnerReference: e.reference, goalId: e.goalId, channel: e.channel });
    else await this.wallet.settleWithdrawal(e.reference, e.type === 'transfer.settled' ? 'paid' : 'failed');
    return { received: true, duplicate: false };
  }
}
