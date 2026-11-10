import { Body, Controller, Get, Headers, HttpCode, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, MaybeUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { badRequest } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { PlansService } from './plans.service.js';

const listBody = z.object({ mode: z.enum(['private', 'free', 'sell']), price: z.number().int().min(0).max(1_000_000_00).optional(), summary: z.string().trim().max(300).optional() });
const buyBody = z.object({ pin: z.string().regex(/^\d{4}$/, 'Your PIN has 4 digits').optional() });

@ApiTags('plans')
@Controller()
class PlansController {
  constructor(private readonly plans: PlansService) {}
  @Public() @Get('plans') browse(@MaybeUser() u: AuthUser | undefined, @Query('filter') filter?: string, @Query('q') q?: string) { return this.plans.browse({ filter, search: q }, u?.id); }
  @ApiBearerAuth() @Get('plans/studio') studio(@CurrentUser() u: AuthUser) { return this.plans.studio(u.id); }
  @Public() @Get('plans/:id') get(@MaybeUser() u: AuthUser | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.plans.get(id, u?.id); }
  @ApiBearerAuth() @HttpCode(200) @Post('plans/:id/buy')
  buy(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(buyBody)) b: z.infer<typeof buyBody>, @Headers('idempotency-key') key?: string) {
    if (!key || key.length < 8) throw badRequest('idempotency_key_required', 'Send an Idempotency-Key header (a fresh UUID per attempt).');
    return this.plans.buy(u.id, id, b.pin ?? '', key);
  }
  @ApiBearerAuth() @Get('trips/:id/plan') listing(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.plans.listingForTrip(u.id, id); }
  @ApiBearerAuth() @Put('trips/:id/plan') list(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(listBody)) b: z.infer<typeof listBody>) { return this.plans.list(u.id, id, b); }
}

@Module({ imports: [WalletModule], controllers: [PlansController], providers: [PlansService], exports: [PlansService] })
export class PlansModule {}
