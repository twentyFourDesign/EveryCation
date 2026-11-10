import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard.js';
import { badRequest, notFound } from '../../common/errors.js';
import { CONFIG, type Config } from '../../config.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { WalletService } from './wallet.service.js';

const kobo = z.number().int().positive().max(1_000_000_000_00);
const pin = z.string().regex(/^\d{4}$/, 'Your PIN has 4 digits');
const identityBody = z.object({ method: z.enum(['BVN', 'NIN']), number: z.string().regex(/^\d{11}$/, 'This number has 11 digits'), dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD') });
const pinBody = z.object({ pin, currentPin: pin.optional() });
const bankBody = z.object({ bankName: z.string().min(2).max(60), accountNumber: z.string().regex(/^\d{10}$/, 'Account numbers have 10 digits') });
const goalBody = z.object({ name: z.string().trim().min(2, 'Give your goal a name').max(60), kind: z.enum(['trip', 'shopping', 'package']), target: kobo, targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), locked: z.boolean().optional(), autoSaveAmount: kobo.optional(), autoSaveFrequency: z.enum(['daily', 'weekly', 'monthly']).optional() });
const goalPatch = goalBody.pick({ name: true, target: true, targetDate: true, locked: true }).partial();
const moveBody = z.object({ amount: kobo, direction: z.enum(['in', 'out']) });
const withdrawBody = z.object({ amount: kobo, source: z.union([z.literal('available'), z.uuid()]), bankAccountId: z.uuid().optional(), pin });
const freezeBody = z.object({ frozen: z.boolean() });
const devDepositBody = z.object({ amount: kobo, goalId: z.uuid().optional(), channel: z.enum(['transfer', 'card']).default('transfer') });

/** Money endpoints need an Idempotency-Key so a retried request can never move money twice. */
const requireKey = (key?: string) => { if (!key || key.length < 8 || key.length > 80) throw badRequest('idempotency_key_required', 'Send an Idempotency-Key header (a fresh UUID per attempt).'); return key; };

@ApiTags('wallet') @ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService, @Inject(CONFIG) private readonly config: Config) {}

  @Get() overview(@CurrentUser() u: AuthUser) { return this.wallet.overview(u.id); }

  @Get('history')
  history(@CurrentUser() u: AuthUser, @Query('before') before?: string, @Query('limit') limit?: string) {
    return this.wallet.history(u.id, { before: before ? new Date(before) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200)
  @Post('identity') identity(@CurrentUser() u: AuthUser, @Body(new ZodPipe(identityBody)) b: z.infer<typeof identityBody>) { return this.wallet.verifyIdentity(u.id, b); }

  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(204)
  @Put('pin') pin(@CurrentUser() u: AuthUser, @Body(new ZodPipe(pinBody)) b: z.infer<typeof pinBody>) { return this.wallet.setPin(u.id, b.pin, b.currentPin); }

  @Post('banks') addBank(@CurrentUser() u: AuthUser, @Body(new ZodPipe(bankBody)) b: z.infer<typeof bankBody>) { return this.wallet.addBank(u.id, b.bankName, b.accountNumber); }

  @HttpCode(200)
  @Post('freeze') freeze(@CurrentUser() u: AuthUser, @Body(new ZodPipe(freezeBody)) b: z.infer<typeof freezeBody>) { return this.wallet.setFrozen(u.id, b.frozen); }

  @Get('goals') goals(@CurrentUser() u: AuthUser) { return this.wallet.goals(u.id); }
  @Post('goals') createGoal(@CurrentUser() u: AuthUser, @Body(new ZodPipe(goalBody)) b: z.infer<typeof goalBody>) { return this.wallet.createGoal(u.id, b); }
  @Patch('goals/:id') updateGoal(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(goalPatch)) b: z.infer<typeof goalPatch>) { return this.wallet.updateGoal(u.id, id, b); }

  @ApiHeader({ name: 'Idempotency-Key', required: true }) @HttpCode(200)
  @Post('goals/:id/move')
  move(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(moveBody)) b: z.infer<typeof moveBody>, @Headers('idempotency-key') key?: string) {
    return this.wallet.moveToGoal(u.id, id, b.amount, b.direction, requireKey(key));
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true }) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('withdrawals')
  withdraw(@CurrentUser() u: AuthUser, @Body(new ZodPipe(withdrawBody)) b: z.infer<typeof withdrawBody>, @Headers('idempotency-key') key?: string) {
    return this.wallet.withdraw(u.id, b, requireKey(key));
  }

  /**
   * Development only: stands in for the bank partner confirming a transfer or card payment,
   * so the apps can be tested before a partner is connected. Does not exist in production.
   */
  @HttpCode(200)
  @Post('dev/deposit')
  devDeposit(@CurrentUser() u: AuthUser, @Body(new ZodPipe(devDepositBody)) b: z.infer<typeof devDepositBody>) {
    if (this.config.NODE_ENV === 'production') throw notFound('Page');
    return this.wallet.creditDeposit({ userId: u.id, amount: b.amount, goalId: b.goalId, channel: b.channel, partnerReference: `DEV-${randomUUID()}` });
  }
}
