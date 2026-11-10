import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../../common/auth.guard.js';
import { notFound } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AdviceService, type Queue } from '../community/advice.service.js';
import { Ledger } from '../wallet/ledger.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { AdminAuthService, AdminGuard, CurrentAdmin, PERMISSIONS, Staff, type Admin } from './admin-auth.js';
import { AdminWalletService } from './admin.service.js';

const loginBody = z.object({ email: z.email('Enter your work email'), password: z.string().min(1).max(200), code: z.string().regex(/^\d{3}\s?\d{3}$/, 'Enter the 6-digit code') });
const decisionBody = z.object({ decision: z.enum(['approve', 'changes', 'reject']), note: z.string().trim().max(500).optional() });
const queues: Queue[] = ['waiting', 'changes', 'rereview', 'decided'];
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
const bearer = (req: Request) => (req.headers.authorization ?? '').split(' ')[1] ?? '';

@ApiTags('admin')
@Controller('admin/auth')
export class AdminLoginController {
  constructor(private readonly auth: AdminAuthService) {}
  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('login')
  login(@Body(new ZodPipe(loginBody)) b: z.infer<typeof loginBody>) { return this.auth.login(b.email, b.password, b.code.replace(/\s/g, '')); }
}

/** Everything staff can do. Every route needs a staff session; `@Staff(area, level)` adds the role check. */
@ApiTags('admin') @ApiBearerAuth()
@Public() // not a customer route: the customer guard steps aside and AdminGuard takes over
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly auth: AdminAuthService, private readonly money: AdminWalletService, private readonly wallet: WalletService, private readonly ledger: Ledger, private readonly advice: AdviceService) {}

  @Get('me')
  async me(@CurrentAdmin() admin: Admin) {
    const access = Object.fromEntries(Object.entries(PERMISSIONS).map(([area, roles]) => [area, roles[admin.role] ?? null]));
    return { admin, access, counts: await this.money.counts() };
  }
  @HttpCode(204) @Post('auth/logout') logout(@Req() req: Request) { return this.auth.logout(bearer(req)); }

  // ───────────── Wallet & withdrawals ─────────────
  @Staff('wallet') @Get('wallet/summary') summary() { return this.money.summary(); }
  @Staff('wallet') @Get('wallet/withdrawals') withdrawals(@Query('status') status?: string) { return this.money.withdrawals(status === 'processing' || status === 'all' ? status : 'held'); }
  @Staff('wallet') @Get('wallet/ledger') ledgerList(@Query('limit') limit?: string) { return this.money.ledger(limit ? Number(limit) : undefined); }
  /** Proof the books balance: all entries sum to zero and every balance matches its entries. */
  @Staff('wallet') @Get('wallet/audit') books() { return this.ledger.audit(); }

  @Staff('wallet', 'edit') @HttpCode(200) @Post('wallet/withdrawals/:id/release')
  release(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) { return this.decideHeld(admin, id, 'release', req); }
  @Staff('wallet', 'edit') @HttpCode(200) @Post('wallet/withdrawals/:id/reject')
  reject(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) { return this.decideHeld(admin, id, 'reject', req); }

  private async decideHeld(admin: Admin, id: string, decision: 'release' | 'reject', req: Request) {
    const w = await this.money.withdrawal(id);
    if (!w) throw notFound('Withdrawal');
    const result = await this.wallet.decideHeld(id, decision, admin.name);
    await this.auth.record(admin, decision === 'release' ? 'Released held withdrawal' : 'Rejected withdrawal, money returned', `${w.reference} · ${naira(w.amount)}`, req);
    return result;
  }

  // ───────────── Advice review ─────────────
  @Staff('moderation') @Get('advice')
  queue(@Query('queue') queue?: string) { return this.advice.reviewQueue(queues.includes(queue as Queue) ? (queue as Queue) : 'waiting'); }

  @Staff('moderation', 'edit') @HttpCode(200) @Post('advice/:id/decision')
  async decide(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionBody)) b: z.infer<typeof decisionBody>, @Req() req: Request) {
    const r = await this.advice.decide(id, b.decision, admin.id, b.note);
    const action = { approve: 'Approved and verified advice', changes: 'Requested changes to advice', reject: 'Rejected advice' }[b.decision];
    await this.auth.record(admin, action, `"${r.excerpt}" · ${r.countryCode}`, req);
    return { status: r.status };
  }

  // ───────────── System ─────────────
  @Staff('settings') @Get('staff') staff() { return this.auth.staff(); }
  @Staff('settings') @Get('audit') audit() { return this.auth.audit(); }
}
