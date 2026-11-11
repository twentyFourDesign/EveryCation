import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Public } from '../../common/auth.guard.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AdviceService, type Queue } from '../community/advice.service.js';
import { ModerationService } from '../community/moderation.service.js';
import { otpauthUrl } from './totp.js';
import { PlansService } from '../plans/plans.service.js';
import { DiscoverService } from '../discover/discover.service.js';
import { MediaService } from '../media/media.service.js';
import { ShopService } from '../shop/shop.service.js';
import { Ledger } from '../wallet/ledger.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { AdminAuthService, AdminGuard, can, CurrentAdmin, PERMISSIONS, Staff, type Admin } from './admin-auth.js';
import { AdminWalletService } from './admin.service.js';

const loginBody = z.object({ email: z.email('Enter your work email'), password: z.string().min(1).max(200), code: z.string().regex(/^\d{3}\s?\d{3}$/, 'Enter the 6-digit code') });
const decisionBody = z.object({ decision: z.enum(['approve', 'changes', 'reject']), note: z.string().trim().max(500).optional() });
const inviteBody = z.object({ email: z.email('Enter a work email'), name: z.string().trim().min(2, 'Enter their name').max(60), role: z.enum(['super_admin', 'moderator', 'finance', 'shop_ops', 'support']) });
const activeBody = z.object({ active: z.boolean() });
const reportDecision = z.object({ targetType: z.enum(['tip', 'comment', 'advice']), targetId: z.uuid(), decision: z.enum(['remove', 'keep']), suspendAuthor: z.boolean().default(false) });
const orderStatusBody = z.object({ status: z.enum(['packed', 'shipped', 'delivered', 'cancelled']) });
const productBody = z.object({ name: z.string().trim().min(2, 'Enter the product name').max(120), brand: z.string().trim().max(60).nullish(), category: z.string().trim().min(2, 'Choose a category').max(60), price: z.number().int().min(100, 'Enter a price'),
  stock: z.number().int().min(0).nullable(), variant: z.string().trim().max(60).nullish(), description: z.string().trim().max(600).default(''), pickedNote: z.string().trim().max(200).nullish(), imageUrl: z.url().nullish(), active: z.boolean().default(true) });
const placeBody = z.object({ name: z.string().trim().min(2, 'Enter the place name').max(60), kind: z.string().trim().min(2, 'Say what kind of place it is').max(30), countryCode: z.string().length(2, 'Choose a country'), summary: z.string().trim().min(20, 'Write a summary of at least 20 characters').max(300),
  bestTime: z.string().trim().max(40).nullish(), currency: z.string().trim().max(40).nullish(), imageUrl: z.url().nullish(), published: z.boolean().default(true) });
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
  constructor(private readonly auth: AdminAuthService, private readonly money: AdminWalletService, private readonly wallet: WalletService, private readonly ledger: Ledger, private readonly advice: AdviceService, private readonly moderation: ModerationService, private readonly plans: PlansService, private readonly shop: ShopService, private readonly discover: DiscoverService, private readonly media: MediaService) {}

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

  // ───────────── Shop products ─────────────
  @Staff('shop') @Get('shop/products') products() { return this.shop.adminProducts(); }
  @Staff('shop', 'edit') @Post('shop/products')
  async addProduct(@CurrentAdmin() admin: Admin, @Body(new ZodPipe(productBody)) b: z.infer<typeof productBody>, @Req() req: Request) {
    const p = await this.shop.saveProduct(null, b); await this.auth.record(admin, 'Added product', `${p.name} · ${naira(p.price)}`, req); return { id: p.id };
  }
  @Staff('shop', 'edit') @Patch('shop/products/:id')
  async editProduct(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(productBody.partial())) b: Partial<z.infer<typeof productBody>>, @Req() req: Request) {
    const p = await this.shop.saveProduct(id, b); await this.auth.record(admin, b.active === false ? 'Hid product' : 'Edited product', `${p.name} · ${naira(p.price)} · stock ${p.stock ?? 'digital'}`, req); return { id: p.id };
  }
  /** One photo for a product or a place, in a multipart field called "file". */
  @Staff() @Post('uploads/:folder') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 9 * 1024 * 1024, files: 1 } }))
  upload(@CurrentAdmin() admin: Admin, @Param('folder') folder: string, @UploadedFile() file?: { buffer: Buffer; size: number }) {
    if (folder !== 'products' && folder !== 'places') throw notFound('Upload folder');
    if (!can(admin.role, folder === 'products' ? 'shop' : 'moderation', 'edit')) throw forbidden('no_access', 'Your role cannot upload here.');
    return this.media.storeImage(folder, file);
  }

  // ───────────── Places ─────────────
  @Staff('moderation') @Get('places') placesList() { return this.discover.adminPlaces(); }
  @Staff('moderation', 'edit') @Post('places')
  async addPlace(@CurrentAdmin() admin: Admin, @Body(new ZodPipe(placeBody)) b: z.infer<typeof placeBody>, @Req() req: Request) {
    const p = await this.discover.savePlace(null, b); await this.auth.record(admin, 'Added place', p.name, req); return p;
  }
  @Staff('moderation', 'edit') @Patch('places/:id')
  async editPlace(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(placeBody.partial())) b: Partial<z.infer<typeof placeBody>>, @Req() req: Request) {
    const p = await this.discover.savePlace(id, b); await this.auth.record(admin, b.published === false ? 'Unpublished place' : 'Edited place', p.name, req); return p;
  }

  // ───────────── Shop orders ─────────────
  @Staff('shop') @Get('shop/orders') shopOrders(@Query('status') status?: string) { return this.shop.allOrders(['placed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(status ?? '') ? status : undefined); }
  @Staff('shop', 'edit') @HttpCode(200) @Post('shop/orders/:id/status')
  async orderStatus(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(orderStatusBody)) b: z.infer<typeof orderStatusBody>, @Req() req: Request) {
    const r = await this.shop.setStatus(id, b.status);
    await this.auth.record(admin, b.status === 'cancelled' ? 'Cancelled and refunded order' : `Marked order as ${b.status}`, r.reference, req);
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
