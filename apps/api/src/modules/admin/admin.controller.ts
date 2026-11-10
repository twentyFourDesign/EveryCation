import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Public } from '../../common/auth.guard.js';
import { badRequest, conflict, notFound } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AdviceService, type Queue } from '../community/advice.service.js';
import { ModerationService } from '../community/moderation.service.js';
import { otpauthUrl } from './totp.js';
import { PlansService } from '../plans/plans.service.js';
import { Ledger } from '../wallet/ledger.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { AdminAuthService, AdminGuard, CurrentAdmin, PERMISSIONS, Staff, type Admin } from './admin-auth.js';
import { AdminWalletService } from './admin.service.js';

const loginBody = z.object({ email: z.email('Enter your work email'), password: z.string().min(1).max(200), code: z.string().regex(/^\d{3}\s?\d{3}$/, 'Enter the 6-digit code') });
const decisionBody = z.object({ decision: z.enum(['approve', 'changes', 'reject']), note: z.string().trim().max(500).optional() });
const inviteBody = z.object({ email: z.email('Enter a work email'), name: z.string().trim().min(2, 'Enter their name').max(60), role: z.enum(['super_admin', 'moderator', 'finance', 'shop_ops', 'support']) });
const activeBody = z.object({ active: z.boolean() });
const reportDecision = z.object({ targetType: z.enum(['tip', 'comment', 'advice']), targetId: z.uuid(), decision: z.enum(['remove', 'keep']), suspendAuthor: z.boolean().default(false) });
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
  constructor(private readonly auth: AdminAuthService, private readonly money: AdminWalletService, private readonly wallet: WalletService, private readonly ledger: Ledger, private readonly advice: AdviceService, private readonly moderation: ModerationService, private readonly plans: PlansService) {}

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

  // ───────────── Creator payouts ─────────────
  @Staff('payouts') @Get('payouts') payouts() { return this.plans.payoutBatch(); }
  @Staff('payouts', 'edit') @HttpCode(200) @Post('payouts/approve')
  async approvePayouts(@CurrentAdmin() admin: Admin, @Req() req: Request) {
    const r = await this.plans.approvePayouts();
    await this.auth.record(admin, 'Approved creator payout batch', `${r.reference} · ${naira(r.total)} to ${r.sellersPaid} seller${r.sellersPaid === 1 ? '' : 's'}`, req);
    return r;
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

  // ───────────── Reports ─────────────
  @Staff('moderation') @Get('reports') reports(@Query('status') status?: string) { return this.moderation.queue(status === 'closed' ? 'closed' : 'open'); }

  @Staff('moderation', 'edit') @HttpCode(200) @Post('reports/decision')
  async decideReport(@CurrentAdmin() admin: Admin, @Body(new ZodPipe(reportDecision)) b: z.infer<typeof reportDecision>, @Req() req: Request) {
    const r = await this.moderation.decide(b.targetType, b.targetId, b.decision, b.suspendAuthor);
    await this.auth.record(admin, `${b.decision === 'remove' ? 'Removed reported' : 'Kept reported'} ${b.targetType}${r.suspended ? ', suspended author' : ''}`, `${r.item} · ${r.reportsClosed} report${r.reportsClosed === 1 ? '' : 's'}`, req);
    return r;
  }

  // ───────────── System ─────────────
  /** Creates a staff account. The temporary password and authenticator secret are returned once and never stored in readable form. */
  @Staff('settings', 'edit') @Post('staff')
  async invite(@CurrentAdmin() admin: Admin, @Body(new ZodPipe(inviteBody)) b: z.infer<typeof inviteBody>, @Req() req: Request) {
    const password = randomBytes(12).toString('base64url');
    let created: { totpSecret: string };
    try { created = await this.auth.createAdmin({ ...b, password }); } catch { throw conflict('staff_exists', 'There is already a staff account with that email.'); }
    await this.auth.record(admin, 'Invited staff member', `${b.email} · ${b.role}`, req);
    return { email: b.email.toLowerCase(), temporaryPassword: password, authenticatorSecret: created.totpSecret, authenticatorLink: otpauthUrl(b.email, created.totpSecret) };
  }
  @Staff('settings', 'edit') @HttpCode(200) @Post('staff/:id/active')
  async setActive(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(activeBody)) b: z.infer<typeof activeBody>, @Req() req: Request) {
    if (id === admin.id) throw badRequest('not_yourself', 'You cannot turn off your own account.');
    const a = await this.auth.setActive(id, b.active);
    if (!a) throw notFound('Staff member');
    await this.auth.record(admin, b.active ? 'Turned staff account back on' : 'Turned staff account off', a.email, req);
    return { active: b.active };
  }
  @Staff('settings') @Get('staff') staff() { return this.auth.staff(); }
  @Staff('settings') @Get('audit') audit() { return this.auth.audit(); }
}
