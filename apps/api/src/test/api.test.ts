import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../db/db.module.js';
import { bankAccounts, ledgerAccounts, outbox, places, products } from '../db/schema.js';
import { createApp } from '../main.js';
import { Ledger } from '../modules/wallet/ledger.service.js';
import { AdminAuthService, type AdminRole } from '../modules/admin/admin-auth.js';
import { totpCode } from '../modules/admin/totp.js';
import { WalletService } from '../modules/wallet/wallet.service.js';
import { signPayload } from '../modules/wallet/webhook.controller.js';
import { createServer, type Server } from 'node:http';
import { AppleVerifier, GoogleApi, type CalendarEvent, type GoogleTokens } from '../modules/auth/google.js';
import { JobsService } from '../modules/jobs/jobs.module.js';

/** Stands in for the map service that place search asks. */
const geocoder = { features: [] as object[], asked: [] as string[], down: false, server: undefined as Server | undefined };

let app: NestExpressApplication; let db: Database['db']; let wallet: WalletService; let ledger: Ledger;
let emailSeq = 0;
const N = (naira: number) => naira * 100;
const http = () => request(app.getHttpServer());
const authed = (token: string) => ({
  get: (p: string) => http().get(`/v1${p}`).set('Authorization', `Bearer ${token}`),
  post: (p: string, body?: object, key: string | null = randomUUID()) => { const r = http().post(`/v1${p}`).set('Authorization', `Bearer ${token}`); if (key) r.set('Idempotency-Key', key); return r.send(body); },
  put: (p: string, body: object) => http().put(`/v1${p}`).set('Authorization', `Bearer ${token}`).send(body),
  patch: (p: string, body: object) => http().patch(`/v1${p}`).set('Authorization', `Bearer ${token}`).send(body),
});

async function signUp() {
  const email = `traveller${++emailSeq}@example.com`;
  const asked = await http().post('/v1/auth/otp/request').send({ email });
  const res = await http().post('/v1/auth/otp/verify').send({ email, code: asked.body.devCode });
  const me = await authed(res.body.accessToken).get('/auth/me');
  return { email, token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, id: me.body.id as string };
}
function webhook(event: object, secret = 'test-partner-secret') {
  const raw = JSON.stringify(event);
  return http().post('/v1/webhooks/partner').set('Content-Type', 'application/json').set('x-signature', signPayload(secret, raw)).send(raw);
}
const fund = (userId: string, naira: number, goalId?: string) => webhook({ type: 'deposit.received', eventId: randomUUID(), userId, amount: N(naira), reference: `PARTNER-${randomUUID()}`, goalId });
/** A user with identity, PIN 2580 and a bank linked more than 24 hours ago. */
async function readyUser(balanceNaira = 0) {
  const u = await signUp(); const api = authed(u.token);
  await api.post('/wallet/identity', { method: 'BVN', number: '22212345678', dateOfBirth: '1990-01-01' }).expect(200);
  await api.put('/wallet/pin', { pin: '2580' }).expect(204);
  const bank = await api.post('/wallet/banks', { bankName: 'GTBank', accountNumber: '0123454821' }).expect(201);
  await db.update(bankAccounts).set({ createdAt: new Date(Date.now() - 48 * 3_600_000) }).where(eq(bankAccounts.id, bank.body.id));
  if (balanceNaira) await fund(u.id, balanceNaira);
  return { ...u, api, bankId: bank.body.id as string };
}
const balance = async (api: ReturnType<typeof authed>) => (await api.get('/wallet')).body as { available: number; inGoals: number; total: number };

beforeAll(async () => {
  geocoder.server = createServer((req, res) => { geocoder.asked.push(decodeURIComponent(req.url ?? '')); res.writeHead(geocoder.down ? 503 : 200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ features: geocoder.features })); }).listen(4599, '127.0.0.1');
  app = await createApp(); await app.init(); db = app.get(Database).db; wallet = app.get(WalletService); ledger = app.get(Ledger);
});
afterAll(async () => { await app.close(); geocoder.server?.close(); });

describe('sign-in', () => {
  it('signs up with an email code and returns the profile', async () => {
    const u = await signUp();
    const me = await authed(u.token).get('/auth/me').expect(200);
    expect(me.body).toMatchObject({ email: u.email, kycStatus: 'none', hasPin: false });
  });
  it('rejects a wrong code, a second request inside a minute, and missing tokens', async () => {
    const email = ' Ada.Obi@Example.com ';
    expect((await http().post('/v1/auth/otp/request').send({ email }).expect(200)).body.sentTo).toBe('a•••@example.com');
    expect((await http().post('/v1/auth/otp/verify').send({ email: 'ada.obi@example.com', code: '000000' }).expect(400)).body.code).toBe('otp_wrong');
    expect((await http().post('/v1/auth/otp/request').send({ email }).expect(429)).body.code).toBe('otp_wait');
    await http().post('/v1/auth/otp/request').send({ email: 'not-an-email' }).expect(400);
    await http().get('/v1/wallet').expect(401);
    await http().get('/v1/health').expect(200);
  });
  it('rotates refresh tokens and ends the session when an old one is reused', async () => {
    const u = await signUp();
    const next = await http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    expect(next.body.refreshToken).not.toBe(u.refreshToken);
    expect((await http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401)).body.code).toBe('session_revoked');
    await http().post('/v1/auth/refresh').send({ refreshToken: next.body.refreshToken }).expect(401);
  });
});

describe('wallet setup', () => {
  it('needs identity, then a strong PIN, then a bank in the same name', async () => {
    const u = await signUp(); const api = authed(u.token);
    expect((await api.put('/wallet/pin', { pin: '2580' }).expect(403)).body.code).toBe('kyc_required');
    expect((await api.post('/wallet/identity', { method: 'BVN', number: '00012345678', dateOfBirth: '1990-01-01' }).expect(400)).body.code).toBe('kyc_failed');
    await api.post('/wallet/identity', { method: 'NIN', number: '22212345678', dateOfBirth: '1990-01-01' }).expect(200);
    expect((await api.put('/wallet/pin', { pin: '1234' }).expect(400)).body.code).toBe('pin_weak');
    await api.put('/wallet/pin', { pin: '2580' }).expect(204);
    expect((await api.put('/wallet/pin', { pin: '9631' }).expect(400)).body.code).toBe('pin_current_required');
    await api.put('/wallet/pin', { pin: '9631', currentPin: '2580' }).expect(204);
    expect((await api.post('/wallet/banks', { bankName: 'Kuda', accountNumber: '1110000000' }).expect(400)).body.code).toBe('bank_name_mismatch');
    expect((await api.post('/wallet/banks', { bankName: 'Kuda', accountNumber: '9990000000' }).expect(400)).body.code).toBe('bank_not_found');
    const bank = await api.post('/wallet/banks', { bankName: 'GTBank', accountNumber: '0123454821' }).expect(201);
    expect(bank.body).toMatchObject({ last4: '4821', isDefault: true });
    expect(JSON.stringify(bank.body)).not.toContain('0123454821');
    expect((await api.get('/wallet')).body.setup).toEqual({ identity: 'verified', hasPin: true, hasBank: true, ready: true });
  });
});

describe('money in', () => {
  it('credits a signed deposit once, however many times the partner sends it', async () => {
    const u = await readyUser();
    const event = { type: 'deposit.received', eventId: randomUUID(), userId: u.id, amount: N(100_000), reference: `PARTNER-${randomUUID()}` };
    expect((await webhook(event).expect(200)).body.duplicate).toBe(false);
    expect((await webhook(event).expect(200)).body.duplicate).toBe(true);
    await webhook({ ...event, eventId: randomUUID() }).expect(200); // new event id, same bank reference
    expect((await balance(u.api)).available).toBe(N(100_000));
    await webhook({ ...event, eventId: randomUUID(), reference: 'X-1' }, 'wrong-secret').expect(401);
    expect((await balance(u.api)).available).toBe(N(100_000));
  });
});

describe('development tools', () => {
  it('can stand in for the bank with a test deposit', async () => {
    const u = await readyUser();
    await u.api.post('/wallet/dev/deposit', { amount: N(40_000) }, null).expect(200);
    expect((await balance(u.api)).available).toBe(N(40_000));
  });
});

describe('savings goals', () => {
  it('moves money in, reports totals, and keeps a locked goal locked', async () => {
    const u = await readyUser(120_000);
    const goal = (await u.api.post('/wallet/goals', { name: 'Dolomites trip', kind: 'trip', target: N(800_000), targetDate: '2026-12-12', locked: true }).expect(201)).body;
    await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(50_000), direction: 'in' }, null).expect(400); // no idempotency key
    const key = randomUUID();
    await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(50_000), direction: 'in' }, key).expect(200);
    expect((await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(50_000), direction: 'in' }, key).expect(200)).body.repeated).toBe(true);
    await fund(u.id, 25_000, goal.id);
    expect(await balance(u.api)).toMatchObject({ available: N(70_000), inGoals: N(75_000), total: N(145_000) });
    expect((await u.api.get('/wallet/goals')).body[0]).toMatchObject({ saved: N(75_000), percent: 9, locked: true });
    expect((await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(10_000), direction: 'out' }).expect(403)).body.code).toBe('goal_locked');
    expect((await u.api.post('/wallet/withdrawals', { amount: N(10_000), source: goal.id, pin: '2580' }).expect(403)).body.code).toBe('goal_locked');
    await u.api.patch(`/wallet/goals/${goal.id}`, { locked: false }).expect(200);
    await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(10_000), direction: 'out' }).expect(200);
    expect((await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(500_000), direction: 'in' }).expect(400)).body.code).toBe('insufficient_funds');
    const history = (await u.api.get('/wallet/history')).body.items;
    expect(history.map((h: { kind: string }) => h.kind)).toEqual(['goal_out', 'deposit', 'goal_in', 'deposit']);
  });
  it("cannot touch another user's goal", async () => {
    const a = await readyUser(50_000); const b = await readyUser(50_000);
    const goal = (await a.api.post('/wallet/goals', { name: 'Mine', kind: 'trip', target: N(100_000) })).body;
    await b.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(5_000), direction: 'in' }).expect(404);
    await b.api.patch(`/wallet/goals/${goal.id}`, { locked: true }).expect(404);
  });
});

describe('withdrawals', () => {
  it('takes the money at once, never twice for the same request, and pays out when the partner confirms', async () => {
    const u = await readyUser(120_000); const key = randomUUID();
    const w = (await u.api.post('/wallet/withdrawals', { amount: N(50_000), source: 'available', pin: '2580' }, key).expect(201)).body;
    expect(w).toMatchObject({ status: 'processing', amount: N(50_000), repeated: false });
    const again = (await u.api.post('/wallet/withdrawals', { amount: N(50_000), source: 'available', pin: '2580' }, key).expect(201)).body;
    expect(again).toMatchObject({ reference: w.reference, repeated: true });
    expect((await balance(u.api)).available).toBe(N(70_000));
    await webhook({ type: 'transfer.settled', eventId: randomUUID(), reference: w.reference }).expect(200);
    await webhook({ type: 'transfer.settled', eventId: randomUUID(), reference: w.reference }).expect(200);
    expect((await balance(u.api)).available).toBe(N(70_000));
    const sent = await db.select().from(outbox).where(sql`${outbox.payload}->>'reference' = ${w.reference}`);
    expect(sent.map((o) => o.topic)).toEqual(['withdrawal.send']);
  });
  it('returns the money when the bank transfer fails', async () => {
    const u = await readyUser(80_000);
    const w = (await u.api.post('/wallet/withdrawals', { amount: N(30_000), source: 'available', pin: '2580' }).expect(201)).body;
    expect((await balance(u.api)).available).toBe(N(50_000));
    await webhook({ type: 'transfer.failed', eventId: randomUUID(), reference: w.reference }).expect(200);
    expect((await balance(u.api)).available).toBe(N(80_000));
  });
  it('locks the PIN after three wrong tries', async () => {
    const u = await readyUser(50_000); const body = { amount: N(5_000), source: 'available', pin: '0001' };
    expect((await u.api.post('/wallet/withdrawals', body).expect(400)).body).toMatchObject({ code: 'pin_wrong', triesLeft: 2 });
    await u.api.post('/wallet/withdrawals', body).expect(400);
    expect((await u.api.post('/wallet/withdrawals', body).expect(429)).body.code).toBe('pin_locked');
    expect((await u.api.post('/wallet/withdrawals', { ...body, pin: '2580' }).expect(429)).body.code).toBe('pin_locked');
    expect((await balance(u.api)).available).toBe(N(50_000));
  });
  it('holds a withdrawal over the daily limit, and Finance can release or reject it', async () => {
    const u = await readyUser(700_000);
    await u.api.post('/wallet/withdrawals', { amount: N(250_000), source: 'available', pin: '2580' }).expect(201);
    const held = (await u.api.post('/wallet/withdrawals', { amount: N(100_000), source: 'available', pin: '2580' }).expect(201)).body;
    expect(held).toMatchObject({ status: 'held', holdReason: 'over_daily_limit' });
    expect((await balance(u.api)).available).toBe(N(350_000));
    expect(await wallet.decideHeld(held.id, 'reject', 'Ada E.')).toEqual({ status: 'rejected' });
    expect((await balance(u.api)).available).toBe(N(450_000));
    await expect(wallet.decideHeld(held.id, 'release', 'Ada E.')).rejects.toMatchObject({ code: 'not_held' });
    const second = (await u.api.post('/wallet/withdrawals', { amount: N(100_000), source: 'available', pin: '2580' }).expect(201)).body;
    expect(await wallet.decideHeld(second.id, 'release', 'Ada E.')).toEqual({ status: 'processing' });
  });
  it('holds a withdrawal to a bank added in the last 24 hours', async () => {
    const u = await readyUser(60_000);
    await db.update(bankAccounts).set({ createdAt: new Date() }).where(eq(bankAccounts.id, u.bankId));
    expect((await u.api.post('/wallet/withdrawals', { amount: N(20_000), source: 'available', pin: '2580' }).expect(201)).body).toMatchObject({ status: 'held', holdReason: 'new_bank' });
  });
  it('blocks a frozen wallet, an unverified user and an overdraft', async () => {
    const u = await readyUser(20_000);
    expect((await u.api.post('/wallet/withdrawals', { amount: N(50_000), source: 'available', pin: '2580' }).expect(400)).body.code).toBe('insufficient_funds');
    expect((await u.api.post('/wallet/withdrawals', { amount: N(500), source: 'available', pin: '2580' }).expect(400)).body.code).toBe('amount_too_low');
    await u.api.post('/wallet/freeze', { frozen: true }, null).expect(200);
    expect((await u.api.post('/wallet/withdrawals', { amount: N(5_000), source: 'available', pin: '2580' }).expect(403)).body.code).toBe('wallet_frozen');
    const fresh = await signUp();
    expect((await authed(fresh.token).post('/wallet/withdrawals', { amount: N(5_000), source: 'available', pin: '2580' }).expect(403)).body.code).toBe('kyc_required');
    expect((await balance(u.api)).available).toBe(N(20_000));
  });
  it('never overspends when twenty withdrawals arrive at the same moment', async () => {
    const u = await readyUser(50_000);
    const results = await Promise.all(Array.from({ length: 20 }, () => u.api.post('/wallet/withdrawals', { amount: N(10_000), source: 'available', pin: '2580' })));
    const ok = results.filter((r) => r.status === 201); const refused = results.filter((r) => r.status === 400);
    expect(ok).toHaveLength(5);
    expect(refused).toHaveLength(15);
    expect(refused.every((r) => r.body.code === 'insufficient_funds')).toBe(true);
    expect((await balance(u.api)).available).toBe(0);
  });
});

let adminSeq = 0;
/** A signed-in staff member with the given role. */
async function staff(role: AdminRole) {
  const email = `staff${++adminSeq}@everycation.app`; const password = 'correct-horse-battery';
  const { totpSecret } = await app.get(AdminAuthService).createAdmin({ email, name: `Staff ${adminSeq}`, role, password });
  const res = await http().post('/v1/admin/auth/login').send({ email, password, code: totpCode(totpSecret) }).expect(200);
  const h = { Authorization: `Bearer ${res.body.token}` };
  return { email, password, totpSecret, token: res.body.token as string, get: (p: string) => http().get(`/v1/admin${p}`).set(h), post: (p: string, body?: object) => http().post(`/v1/admin${p}`).set(h).send(body), patch: (p: string, body: object) => http().patch(`/v1/admin${p}`).set(h).send(body) };
}
async function named(name: string) { const u = await signUp(); const api = authed(u.token); await api.patch('/auth/me', { name }).expect(200); return { ...u, api }; }

describe('staff sign-in', () => {
  it('needs the right password and authenticator code, and never says which was wrong', async () => {
    const s = await staff('finance');
    const bad1 = await http().post('/v1/admin/auth/login').send({ email: s.email, password: 'wrong-password', code: totpCode(s.totpSecret) }).expect(401);
    const bad2 = await http().post('/v1/admin/auth/login').send({ email: s.email, password: s.password, code: '000000' }).expect(401);
    const bad3 = await http().post('/v1/admin/auth/login').send({ email: 'nobody@everycation.app', password: s.password, code: '123456' }).expect(401);
    expect(new Set([bad1.body.message, bad2.body.message, bad3.body.message]).size).toBe(1);
    expect((await s.get('/me').expect(200)).body).toMatchObject({ admin: { role: 'finance' }, access: { wallet: 'edit', moderation: null } });
    await s.post('/auth/logout').expect(204);
    await s.get('/me').expect(401);
  });
  it('keeps customers and staff apart', async () => {
    const u = await signUp();
    await http().get('/v1/admin/wallet/summary').set('Authorization', `Bearer ${u.token}`).expect(401);
    await http().get('/v1/admin/wallet/summary').expect(401);
  });
});

describe('Finance and held withdrawals', () => {
  it('lets Finance release or reject, records it in the audit log, and stops other roles', async () => {
    const u = await readyUser(700_000); const finance = await staff('finance'); const moderator = await staff('moderator'); const support = await staff('support'); const boss = await staff('super_admin');
    await u.api.post('/wallet/withdrawals', { amount: N(290_000), source: 'available', pin: '2580' }).expect(201);
    const a = (await u.api.post('/wallet/withdrawals', { amount: N(100_000), source: 'available', pin: '2580' }).expect(201)).body;
    const b = (await u.api.post('/wallet/withdrawals', { amount: N(50_000), source: 'available', pin: '2580' }).expect(201)).body;
    const held = (await finance.get('/wallet/withdrawals?status=held').expect(200)).body;
    expect(held.find((w: { id: string }) => w.id === a.id)).toMatchObject({ reason: 'Over daily limit', amount: N(100_000), to: 'GTBank •••• 4821' });
    await moderator.get('/wallet/withdrawals').expect(403);
    await support.get('/wallet/withdrawals').expect(200);
    await support.post(`/wallet/withdrawals/${a.id}/release`).expect(403);
    expect((await finance.post(`/wallet/withdrawals/${a.id}/reject`).expect(200)).body.status).toBe('rejected');
    expect((await finance.post(`/wallet/withdrawals/${b.id}/release`).expect(200)).body.status).toBe('processing');
    await finance.post(`/wallet/withdrawals/${b.id}/release`).expect(409);
    expect((await balance(u.api)).available).toBe(N(360_000));
    const summary = (await finance.get('/wallet/summary').expect(200)).body;
    expect(summary.totalHeld).toBe(summary.available + summary.inGoals);
    expect((await finance.get('/wallet/ledger').expect(200)).body[0]).toHaveProperty('reference');
    const log = (await boss.get('/audit').expect(200)).body;
    expect(log.slice(0, 2).map((l: { action: string }) => l.action)).toEqual(['Released held withdrawal', 'Rejected withdrawal, money returned']);
    expect(log[0].item).toContain(b.reference);
    await finance.get('/staff').expect(200); await moderator.get('/audit').expect(403);
  });
});

describe('tips', () => {
  it('lets a signed-in traveller post, like and comment, and guests read', async () => {
    const amaka = await named('Amaka O.'); const tunde = await named('Tunde A.');
    await http().post('/v1/tips').send({ title: 'x' }).expect(401);
    expect((await amaka.api.post('/tips', { title: 'short', place: 'Bali', category: 'Temples' }, null).expect(400)).body.code).toBe('invalid_input');
    const tip = (await amaka.api.post('/tips', { title: 'Reach Ulun Danu before the tour buses', place: 'Bali, Indonesia', countryCode: 'id', category: 'Temples', body: 'Go at opening time.', goodToKnow: ['Bring a sarong.'] }, null).expect(201)).body;
    expect(tip).toMatchObject({ countryCode: 'ID', author: { name: 'Amaka O.' }, likes: 0, mine: true });
    expect((await tunde.api.post(`/tips/${tip.id}/like`, {}, null).expect(200)).body).toEqual({ liked: true, likes: 1 });
    expect((await authed(tunde.token).get(`/tips/${tip.id}`)).body.liked).toBe(true);
    expect((await tunde.api.post(`/tips/${tip.id}/like`, {}, null).expect(200)).body).toEqual({ liked: false, likes: 0 });
    await tunde.api.post(`/tips/${tip.id}/like`, {}, null);
    const thread = (await tunde.api.post(`/tips/${tip.id}/comments`, { body: 'Confirmed, went last month.' }, null).expect(201)).body;
    await amaka.api.post(`/tips/${tip.id}/comments`, { body: 'Thanks!' }, null).expect(201);
    expect(thread[0]).toMatchObject({ author: { name: 'Tunde A.' }, isTipAuthor: false, mine: true });
    const guest = (await http().get(`/v1/tips/${tip.id}`).expect(200)).body;
    expect(guest).toMatchObject({ likes: 1, comments: 2, liked: false, mine: false });
    expect((await http().get('/v1/tips?q=ulun').expect(200)).body.some((t: { id: string }) => t.id === tip.id)).toBe(true);
    expect((await http().get(`/v1/tips?authorId=${amaka.id}`).expect(200)).body).toHaveLength(1);
    expect((await http().get(`/v1/users/${amaka.id}`).expect(200)).body).toMatchObject({ name: 'Amaka O.', tips: 1, countries: 1 });
    expect((await amaka.api.post('/reports', { targetType: 'tip', targetId: tip.id, reason: 'Spam' }, null).expect(409)).body.code).toBe('own_content');
    expect((await tunde.api.post('/reports', { targetType: 'tip', targetId: tip.id, reason: 'Spam links' }, null).expect(200)).body.alreadyReported).toBe(false);
    expect((await tunde.api.post('/reports', { targetType: 'tip', targetId: tip.id, reason: 'Spam links' }, null).expect(200)).body.alreadyReported).toBe(true);
  });
});

describe('advice and the review queue', () => {
  const text = 'Almost everywhere took cards, even small cafés. I only needed cash once.';
  it('shows advice as Verified only after a moderator approves it', async () => {
    const wole = await named('Wole O.'); const reader = await named('Reader'); const mod = await staff('moderator'); const finance = await staff('finance');
    const sent = (await wole.api.post('/advice', { countryCode: 'is', city: 'Reykjavík', topic: 'Money', body: text, visited: 'July 2025', status: 'verified' }, null).expect(201)).body;
    expect(sent.status).toBe('in_review'); // a client cannot mark its own advice verified
    const see = async (who: typeof wole, verifiedOnly = true) => ((await who.api.get(`/advice?country=IS&verifiedOnly=${verifiedOnly}`)).body as { id: string; status: string }[]).find((a) => a.id === sent.id);
    expect(await see(reader)).toBeUndefined();
    expect((await see(reader, false))?.status).toBe('in_review');
    expect((await see(wole))?.status).toBe('in_review'); // the author always sees their own

    await finance.get('/advice').expect(403);
    const queue = (await mod.get('/advice?queue=waiting').expect(200)).body;
    expect(queue.items.find((a: { id: string }) => a.id === sent.id)).toMatchObject({ city: 'Reykjavík', author: { name: 'Wole O.', approved: 0 }, evidence: [] });
    expect((await mod.post(`/advice/${sent.id}/decision`, { decision: 'changes' }).expect(400)).body.code).toBe('note_required');
    await mod.post(`/advice/${sent.id}/decision`, { decision: 'changes', note: 'Please say which month this applied to.' }).expect(200);
    expect(await see(reader, false)).toBeUndefined();
    expect(await see(wole)).toMatchObject({ status: 'changes_requested', reviewNote: 'Please say which month this applied to.' });
    await reader.api.patch(`/advice/${sent.id}`, { body: text + ' Edited by someone else.' }).expect(404);
    await wole.api.patch(`/advice/${sent.id}`, { body: text + ' This was in July 2025.' }).expect(200);

    expect((await mod.post(`/advice/${sent.id}/decision`, { decision: 'approve' }).expect(200)).body.status).toBe('verified');
    await mod.post(`/advice/${sent.id}/decision`, { decision: 'reject', note: 'Changed my mind' }).expect(409);
    expect((await see(reader))?.status).toBe('verified');
    expect((await http().get('/v1/advice/countries').expect(200)).body.find((c: { code: string }) => c.code === 'IS')).toMatchObject({ verified: 1 });
    expect((await reader.api.post(`/advice/${sent.id}/helpful`, {}, null).expect(200)).body).toEqual({ markedHelpful: true, helpful: 1 });
    await wole.api.post(`/advice/${sent.id}/helpful`, {}, null).expect(403);
    await wole.api.patch(`/advice/${sent.id}`, { body: text + ' Sneaky edit after approval.' }).expect(409);
    const decided = (await mod.get('/advice?queue=decided')).body;
    expect(decided.items.find((a: { id: string }) => a.id === sent.id)).toMatchObject({ status: 'verified', reviewedBy: expect.stringContaining('Staff') });
  });
  it('sends verified advice back to review after three reports from different people', async () => {
    const author = await named('Chidi E.'); const mod = await staff('moderator');
    const a = (await author.api.post('/advice', { countryCode: 'GB', city: 'London', topic: 'Entry & visa', body: 'No bank statement is needed for a visit visa at all.' }, null)).body;
    await mod.post(`/advice/${a.id}/decision`, { decision: 'approve' }).expect(200);
    const status = async () => ((await author.api.get('/advice?country=GB')).body as { id: string; status: string }[]).find((x) => x.id === a.id)?.status;
    const r1 = await named('R1'); const r2 = await named('R2'); const r3 = await named('R3');
    await r1.api.post('/reports', { targetType: 'advice', targetId: a.id, reason: 'Out of date' }, null).expect(200);
    await r1.api.post('/reports', { targetType: 'advice', targetId: a.id, reason: 'Out of date' }, null).expect(200); // same person twice counts once
    await r2.api.post('/reports', { targetType: 'advice', targetId: a.id, reason: 'Out of date' }, null).expect(200);
    expect(await status()).toBe('verified');
    await r3.api.post('/reports', { targetType: 'advice', targetId: a.id, reason: 'Wrong' }, null).expect(200);
    expect(await status()).toBe('rereview');
    expect(((await r1.api.get('/advice?country=GB')).body as { id: string }[]).some((x) => x.id === a.id)).toBe(false);
    const q = (await mod.get('/advice?queue=rereview')).body;
    expect(q.items.find((x: { id: string }) => x.id === a.id)).toMatchObject({ reports: 3 });
    await mod.post(`/advice/${a.id}/decision`, { decision: 'reject', note: 'Out of date since 2025.' }).expect(200);
    expect(await status()).toBe('rejected');
  });
});

describe('ledger integrity', () => {
  it('balances to zero with every running balance in step with its entries', async () => {
    expect(await ledger.audit()).toEqual({ entriesSum: 0, accountsOutOfStep: 0 });
    const [clearing] = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.kind, 'payout_clearing'));
    expect(clearing!.balance).toBeGreaterThan(0); // withdrawals still on their way
  });
  it('is refused by the database when a transaction does not balance, overdraws, or edits history', async () => {
    const u = await readyUser(10_000);
    const [acct] = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.userId, u.id));
    await expect(db.transaction(async (tx) => {
      const [t] = await tx.execute(sql`INSERT INTO ledger_transactions (kind, reference, description) VALUES ('deposit', ${'BAD-' + randomUUID()}, 'unbalanced') RETURNING id`).then((r) => r.rows as { id: string }[]);
      await tx.execute(sql`INSERT INTO ledger_entries (transaction_id, account_id, amount) VALUES (${t!.id}, ${acct!.id}, 500000)`);
    })).rejects.toThrow();
    await expect(db.execute(sql`UPDATE ledger_accounts SET balance = -1 WHERE id = ${acct!.id}`)).rejects.toThrow();
    await expect(db.execute(sql`UPDATE ledger_entries SET amount = amount + 1 WHERE account_id = ${acct!.id}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM ledger_entries WHERE account_id = ${acct!.id}`)).rejects.toThrow();
    expect(await ledger.audit()).toEqual({ entriesSum: 0, accountsOutOfStep: 0 });
  });
});

describe('notifications, reports and staff invites', () => {
  it('tells the author about comments and review decisions', async () => {
    const author = await named('Ngozi A.'); const fan = await named('Fan'); const mod = await staff('moderator');
    const tip = (await author.api.post('/tips', { title: 'Carry small notes for the ferry', place: 'Lagos, Nigeria', category: 'Money', body: 'The ticket desk rarely has change.' }, null)).body;
    await fan.api.post(`/tips/${tip.id}/comments`, { body: 'Good to know.' }, null).expect(201);
    await author.api.post(`/tips/${tip.id}/comments`, { body: 'Welcome.' }, null).expect(201); // your own comment does not notify you
    const a = (await author.api.post('/advice', { countryCode: 'KE', city: 'Nairobi', topic: 'Money', body: 'Mobile money is accepted nearly everywhere, even by street vendors.' }, null)).body;
    await mod.post(`/advice/${a.id}/decision`, { decision: 'approve' }).expect(200);
    const inbox = (await author.api.get('/notifications').expect(200)).body;
    expect(inbox.unread).toBe(2);
    expect(inbox.items.map((n: { text: string }) => n.text)).toEqual(['Your advice for Nairobi was approved and now shows as Verified.', 'Fan commented on your tip "Carry small notes for the ferry"']);
    expect(inbox.items[0]).toMatchObject({ href: '/advice/KE', read: false });
    await author.api.post('/notifications/read', {}, null).expect(204);
    expect((await author.api.get('/notifications/unread')).body).toEqual({ unread: 0 });
    expect((await fan.api.get('/notifications')).body.unread).toBe(0);
  });
  it('lets a moderator remove reported content, tell the author and suspend them', async () => {
    const spammer = await named('Cheap Visas'); const r1 = await named('Rep One'); const r2 = await named('Rep Two'); const mod = await staff('moderator'); const finance = await staff('finance');
    const tip = (await spammer.api.post('/tips', { title: 'Guaranteed visa in two days', place: 'Dubai, UAE', category: 'Money', body: 'Message my agent to pay.' }, null)).body;
    const other = (await r1.api.post('/tips', { title: 'Metro day pass is worth it', place: 'Dubai, UAE', category: 'Getting there', body: 'It covers the tram too.' }, null)).body;
    const comment = (await spammer.api.post(`/tips/${other.id}/comments`, { body: 'DM me for cheap visas' }, null)).body.at(-1);
    await r1.api.post('/reports', { targetType: 'tip', targetId: tip.id, reason: 'Scam or false claims' }, null).expect(200);
    await r2.api.post('/reports', { targetType: 'tip', targetId: tip.id, reason: 'Selling services' }, null).expect(200);
    await r2.api.post('/reports', { targetType: 'comment', targetId: comment.id, reason: 'Spam' }, null).expect(200);
    await finance.get('/reports').expect(403);
    const open = (await mod.get('/reports').expect(200)).body as { targetId: string; reports: number; item: string; author: { name: string } }[];
    expect(open.find((x) => x.targetId === tip.id)).toMatchObject({ reports: 2, item: 'Tip · "Guaranteed visa in two days"', author: { name: 'Cheap Visas' } });
    expect((await mod.get('/me')).body.counts.openReports).toBeGreaterThanOrEqual(2);
    await mod.post('/reports/decision', { targetType: 'comment', targetId: comment.id, decision: 'remove' }).expect(400); // a removal needs a reason
    await mod.post('/reports/decision', { targetType: 'comment', targetId: comment.id, decision: 'remove', reason: 'other' }).expect(400); // and "other" needs a note
    await mod.post('/reports/decision', { targetType: 'comment', targetId: comment.id, decision: 'remove', reason: 'offensive' }).expect(200);
    expect((await http().get(`/v1/tips/${other.id}`)).body.comments).toBe(0);
    expect((await mod.post('/reports/decision', { targetType: 'tip', targetId: tip.id, decision: 'remove', reason: 'spam', note: 'It only advertises a visa agent.', suspendAuthor: true }).expect(200)).body).toMatchObject({ reportsClosed: 2, suspended: true });
    await mod.post('/reports/decision', { targetType: 'tip', targetId: tip.id, decision: 'remove', reason: 'spam' }).expect(409);
    await http().get(`/v1/tips/${tip.id}`).expect(404);
    expect((await spammer.api.get('/auth/me').expect(403)).body.code).toBe('account_suspended');
    await http().post('/v1/auth/refresh').send({ refreshToken: spammer.refreshToken }).expect(401);
    expect(((await mod.get('/reports?status=closed')).body as { targetId: string }[]).some((x) => x.targetId === tip.id)).toBe(true);
  });
  it('lets a Super admin invite staff and turn an account off', async () => {
    const boss = await staff('super_admin'); const mod = await staff('moderator');
    await mod.post('/staff', { email: 'new@everycation.app', name: 'New Person', role: 'support' }).expect(403);
    const invite = (await boss.post('/staff', { email: 'Bisi@everycation.app', name: 'Bisi L.', role: 'support' }).expect(201)).body;
    expect(invite).toMatchObject({ email: 'bisi@everycation.app' }); expect(invite.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    await boss.post('/staff', { email: 'bisi@everycation.app', name: 'Again', role: 'support' }).expect(409);
    const login = () => http().post('/v1/admin/auth/login').send({ email: invite.email, password: invite.temporaryPassword, code: totpCode(invite.authenticatorSecret) });
    const session = (await login().expect(200)).body;
    const bisi = ((await boss.get('/staff')).body as { id: string; email: string }[]).find((x) => x.email === invite.email)!;
    await boss.post(`/staff/${bisi.id}/active`, { active: false }).expect(200);
    await http().get('/v1/admin/me').set('Authorization', `Bearer ${session.token}`).expect(401);
    await login().expect(401);
    const me = ((await boss.get('/staff')).body as { id: string; email: string }[]).find((x) => x.email === boss.email)!;
    await boss.post(`/staff/${me.id}/active`, { active: false }).expect(400);
  });
});

describe('trips and the bucket list', () => {
  it('keeps a timeline with an itinerary, private to its owner', async () => {
    const u = await named('Wole O.'); const other = await named('Other');
    expect((await u.api.post('/trips', { title: 'Back to front', place: 'Rome', countryCode: 'IT', startDate: '2027-01-10', endDate: '2027-01-02' }, null).expect(400)).body.code).toBe('dates_out_of_order');
    const future = (await u.api.post('/trips', { title: 'Dolomites trip', place: 'Dolomites, Italy', countryCode: 'it', startDate: '2099-12-12', endDate: '2099-12-19', travellers: 2 }, null).expect(201)).body;
    expect(future).toMatchObject({ status: 'upcoming', nights: 7, countryCode: 'IT' }); expect(future.daysAway).toBeGreaterThan(1000);
    await u.api.post('/trips', { title: 'Iceland ring road', place: 'Iceland', countryCode: 'IS', startDate: '2025-07-04', endDate: '2025-07-11' }, null).expect(201);
    expect(((await u.api.get('/trips')).body as { status: string }[]).map((t) => t.status)).toEqual(['upcoming', 'past']);
    expect((await u.api.post(`/trips/${future.id}/items`, { day: '2099-11-01', time: '09:00', title: 'Too early' }, null).expect(400)).body.code).toBe('day_outside_trip');
    await u.api.post(`/trips/${future.id}/items`, { day: '2099-12-13', time: '09:00', title: 'Tre Cime loop hike', note: 'About 10 km' }, null).expect(201);
    const full = (await u.api.post(`/trips/${future.id}/items`, { day: '2099-12-13', time: '07:30', title: 'Drive to Rifugio Auronzo' }, null).expect(201)).body;
    expect(full.itinerary.map((i: { time: string }) => i.time)).toEqual(['07:30', '09:00']);
    await other.api.get(`/trips/${future.id}`).expect(404);
    await other.api.post(`/trips/${future.id}/items`, { day: '2099-12-13', time: '10:00', title: 'Not mine' }, null).expect(404);
    await u.api.post('/bucket-list', { title: 'Swim a hidden cove', source: 'tip:abc' }, null).expect(200);
    const list = (await u.api.post('/bucket-list', { title: 'Swim a hidden cove', source: 'tip:abc' }, null).expect(200)).body; // adding twice keeps one
    expect(list).toHaveLength(1);
    expect((await u.api.patch(`/bucket-list/${list[0].id}`, { state: 'done' }).expect(200)).body[0].state).toBe('done');
  });
  it('shows a matching past trip to the moderator as evidence of the visit', async () => {
    const u = await named('Ifeoma N.'); const mod = await staff('moderator');
    await u.api.post('/trips', { title: 'Accra weekend', place: 'Accra, Ghana', countryCode: 'GH', startDate: '2026-01-16', endDate: '2026-01-19' }, null).expect(201);
    await u.api.post('/trips', { title: 'Tokyo next year', place: 'Tokyo, Japan', countryCode: 'JP', startDate: '2099-03-01', endDate: '2099-03-09' }, null).expect(201);
    const gh = (await u.api.post('/advice', { countryCode: 'GH', city: 'Accra', topic: 'Getting around', body: 'Use the ride apps from Kotoka. The taxi rank quotes about double.' }, null)).body;
    const jp = (await u.api.post('/advice', { countryCode: 'JP', city: 'Tokyo', topic: 'Money', body: 'You need cash for most small restaurants, so withdraw at the airport.' }, null)).body;
    const items = (await mod.get('/advice?queue=waiting')).body.items as { id: string; evidence: string[] }[];
    expect(items.find((x) => x.id === gh.id)!.evidence).toEqual(['Trip on timeline: Accra weekend, 16 Jan 2026 to 19 Jan 2026']);
    expect(items.find((x) => x.id === jp.id)!.evidence).toEqual([]); // a trip that has not started proves nothing
  });
});

describe('media on tips', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');
  const upload = (token: string, data: Buffer, name: string, type: string) => http().post('/v1/media').set('Authorization', `Bearer ${token}`).attach('file', data, { filename: name, contentType: type });
  it('accepts a real photo, attaches it to a tip and serves it', async () => {
    const u = await named('Photo Person'); const other = await named('Someone Else');
    await http().post('/v1/media').attach('file', png, 'a.png').expect(401);
    const up = (await upload(u.token, png, 'a.png', 'image/png').expect(201)).body;
    expect(up).toMatchObject({ kind: 'image' }); expect(up.url).toMatch(/\/media\/tips\/\d{4}\/\d{2}\/.+\.png$/);
    const served = await http().get(new URL(up.url).pathname).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    const tip = (await u.api.post('/tips', { title: 'Sunrise at the lake is worth it', place: 'Braies, Italy', category: 'Sights', body: 'Be there by six.', mediaId: up.id }, null).expect(201)).body;
    expect(tip.media).toEqual({ kind: 'image', url: up.url });
    await other.api.post('/tips', { title: 'Borrowing a photo that is not mine', place: 'Braies, Italy', category: 'Sights', mediaId: up.id }, null).expect(404);
  });
  it('refuses files that are not what they claim to be', async () => {
    const u = await named('Uploader');
    expect((await upload(u.token, Buffer.from('<script>alert(1)</script>'), 'evil.jpg', 'image/jpeg').expect(400)).body.code).toBe('file_type');
    expect((await upload(u.token, Buffer.concat([png, Buffer.alloc(9 * 1024 * 1024)]), 'big.png', 'image/png').expect(400)).body.code).toBe('file_too_large');
    expect((await http().post('/v1/media').set('Authorization', `Bearer ${u.token}`).expect(400)).body.code).toBe('file_required');
  });
});

describe('places, search and following', () => {
  it('finds places, tips and travellers, and shows a place with its tips', async () => {
    await db.insert(places).values({ slug: 'zanzibar', name: 'Zanzibar', kind: 'Island', countryCode: 'TZ', summary: 'Spice farms and white sand.' }).onConflictDoNothing();
    const zed = await named('Zuri Zanzibar-Fan');
    const tip = (await zed.api.post('/tips', { title: 'Book the Stone Town ferry a day ahead', place: 'Zanzibar, Tanzania', countryCode: 'TZ', category: 'Getting there', body: 'Morning boats sell out.' }, null)).body;
    const found = (await http().get('/v1/search?q=zanzib').expect(200)).body;
    expect(found.places.map((p: { id: string }) => p.id)).toEqual(['zanzibar']);
    expect(found.tips.some((t: { id: string }) => t.id === tip.id)).toBe(true);
    expect(found.travellers[0]).toMatchObject({ name: 'Zuri Zanzibar-Fan', tips: 1 });
    expect((await http().get('/v1/search?q=z').expect(200)).body.tips).toEqual([]);
    const place = (await http().get('/v1/places/zanzibar').expect(200)).body;
    expect(place).toMatchObject({ name: 'Zanzibar', countryCode: 'TZ' }); expect(place.tips.map((t: { id: string }) => t.id)).toContain(tip.id);
    await http().get('/v1/places/nowhere').expect(404);
  });
  it('lets travellers follow each other and builds a following feed', async () => {
    const a = await named('Amaka O.'); const b = await named('Wole O.');
    const tip = (await a.api.post('/tips', { title: 'Temple mornings beat the crowds', place: 'Ubud, Indonesia', category: 'Sights', body: 'Be there at opening.' }, null)).body;
    expect((await b.api.get('/feed/following')).body).toEqual([]);
    expect((await b.api.post(`/travellers/${a.id}/follow`, {}, null).expect(200)).body).toEqual({ following: true });
    await b.api.post(`/travellers/${b.id}/follow`, {}, null).expect(400);
    expect((await b.api.get(`/travellers/${a.id}`)).body).toMatchObject({ name: 'Amaka O.', followers: 1, followedByMe: true, isMe: false, tips: 1 });
    expect((await http().get(`/v1/travellers/${a.id}`)).body).toMatchObject({ followers: 1, followedByMe: false });
    expect(((await b.api.get('/feed/following')).body as { id: string }[]).map((t) => t.id)).toEqual([tip.id]);
    expect((await a.api.get('/notifications')).body.items[0]).toMatchObject({ text: 'Wole O. started following you', href: `/traveller/${b.id}` });
    expect((await b.api.post(`/travellers/${a.id}/follow`, {}, null)).body).toEqual({ following: false });
    expect((await b.api.get(`/travellers/${a.id}`)).body.followers).toBe(0);
  });
});

describe('trip plans marketplace', () => {
  const stops = async (u: Awaited<ReturnType<typeof named>>, tripId: string, day: string) => { for (const [time, title] of [['08:00', 'Breakfast by the lake'], ['10:00', 'Cable car up'], ['15:00', 'Old town walk']] as const) await u.api.post(`/trips/${tripId}/items`, { day, time, title }, null).expect(201); };
  async function seller(name: string, verified = true) {
    const u = await named(name);
    if (verified) await u.api.post('/wallet/identity', { method: 'BVN', number: '22212345678', dateOfBirth: '1990-01-01' }).expect(200);
    const past = (await u.api.post('/trips', { title: `${name} in the Dolomites`, place: 'Cortina, Italy', countryCode: 'IT', startDate: '2026-09-01', endDate: '2026-09-07' }, null)).body;
    await stops(u, past.id, '2026-09-01'); await u.api.post(`/trips/${past.id}/items`, { day: '2026-09-02', time: '06:30', title: 'Sunrise at Braies' }, null);
    return { ...u, tripId: past.id as string };
  }
  it('opens a paid plan for sale only after the trip has ended', async () => {
    const s = await seller('Amaka O.');
    const future = (await s.api.post('/trips', { title: 'Next winter', place: 'Zermatt, Switzerland', countryCode: 'CH', startDate: '2099-01-01', endDate: '2099-01-05' }, null)).body;
    expect((await s.api.put(`/trips/${future.id}/plan`, { mode: 'sell', price: N(6_500) }).expect(400)).body.code).toBe('plan_too_thin');
    await stops(s, future.id, '2099-01-02');
    expect((await s.api.put(`/trips/${future.id}/plan`, { mode: 'sell', price: N(500) }).expect(400)).body.code).toBe('price_too_low');
    const scheduled = (await s.api.put(`/trips/${future.id}/plan`, { mode: 'sell', price: N(6_500) }).expect(200)).body;
    expect(scheduled).toMatchObject({ status: 'scheduled', opensAt: '2099-01-06T05:00:00.000Z', sellerGets: N(4_875), fee: N(1_625) });
    const live = (await s.api.put(`/trips/${s.tripId}/plan`, { mode: 'sell', price: N(7_500) }).expect(200)).body;
    expect(live.status).toBe('on_sale');
    const listed = (await http().get('/v1/plans').expect(200)).body as { id: string }[];
    expect(listed.some((p) => p.id === live.id)).toBe(true); expect(listed.some((p) => p.id === scheduled.id)).toBe(false);
    await http().get(`/v1/plans/${scheduled.id}`).expect(404); // not visible to others before the sale opens
    const free = (await s.api.put(`/trips/${future.id}/plan`, { mode: 'free' }).expect(200)).body; // free sharing is allowed any time
    expect(free).toMatchObject({ status: 'free', price: 0 });
    expect(((await http().get('/v1/plans?filter=free')).body as { id: string }[]).some((p) => p.id === free.id)).toBe(true);
  });
  it('takes 25% on a sale, unlocks the plan for the buyer and pays the seller when Finance approves', async () => {
    const s = await seller('Tunde A.'); const unverified = await seller('No ID Yet', false); const buyer = await readyUser(50_000); const finance = await staff('finance'); const mod = await staff('moderator');
    const plan = (await s.api.put(`/trips/${s.tripId}/plan`, { mode: 'sell', price: N(7_500) })).body;
    const plan2 = (await unverified.api.put(`/trips/${unverified.tripId}/plan`, { mode: 'sell', price: N(4_000) })).body;
    const preview = (await buyer.api.get(`/plans/${plan.id}`)).body;
    expect(preview).toMatchObject({ unlocked: false, lockedStops: 1, stops: 4, days: 7 }); expect(preview.itinerary).toHaveLength(3);
    expect((await buyer.api.post(`/plans/${plan.id}/buy`, { pin: '0000' }).expect(400)).body.code).toBe('pin_wrong');
    const key = randomUUID();
    await buyer.api.post(`/plans/${plan.id}/buy`, { pin: '2580' }, key).expect(200);
    expect((await buyer.api.post(`/plans/${plan.id}/buy`, { pin: '2580' }, key).expect(200)).body.repeated).toBe(true);
    await buyer.api.post(`/plans/${plan2.id}/buy`, { pin: '2580' }).expect(200);
    expect((await balance(buyer.api)).available).toBe(N(50_000 - 7_500 - 4_000));
    expect((await buyer.api.get(`/plans/${plan.id}`)).body).toMatchObject({ unlocked: true, owned: true, lockedStops: 0 });
    expect((await s.api.post(`/plans/${plan.id}/buy`, { pin: '2580' }).expect(409)).body.code).toBe('own_plan');
    expect(((await buyer.api.get('/plans?filter=owned')).body as { id: string }[]).map((p) => p.id).sort()).toEqual([plan.id, plan2.id].sort());
    const studio = (await s.api.get('/plans/studio')).body;
    expect(studio).toMatchObject({ month: { sales: 1, gross: N(7_500), fee: N(1_875), net: N(5_625) }, waitingForPayout: N(5_625), canBePaid: true, feePercent: 25 });
    expect((await s.api.get('/notifications')).body.items[0].text).toContain('₦5,625 is in your next payout');

    await mod.get('/payouts').expect(403);
    const batch = (await finance.get('/payouts').expect(200)).body;
    expect(batch.sellers.find((x: { sellerId: string }) => x.sellerId === s.id)).toMatchObject({ sales: 1, gross: N(7_500), fee: N(1_875), owed: N(5_625), held: null });
    expect(batch.sellers.find((x: { sellerId: string }) => x.sellerId === unverified.id)).toMatchObject({ owed: N(3_000), held: 'ID not verified' });
    const before = (await balance(s.api)).available;
    const done = (await finance.post('/payouts/approve').expect(200)).body;
    expect(done.sellersPaid).toBeGreaterThanOrEqual(1);
    expect((await balance(s.api)).available).toBe(before + N(5_625));
    expect((await balance(unverified.api)).available).toBe(0); // held until the ID check passes
    expect((await s.api.get('/plans/studio')).body.waitingForPayout).toBe(0);
    expect(((await finance.get('/payouts')).body.sellers as { sellerId: string }[]).some((x) => x.sellerId === s.id)).toBe(false);
    expect(await ledger.audit()).toEqual({ entriesSum: 0, accountsOutOfStep: 0 });
  });
});

describe('shop', () => {
  const address = '12 Admiralty Way, Lekki Phase 1, Lagos'; const phone = '08031234821';
  it('pays for an order from the goal first, then the balance, and keeps stock honest', async () => {
    const [bag, holder, esim] = await db.insert(products).values([
      { name: 'Test backpack', category: 'Backpacks & bags', price: N(95_000), stock: 2 }, { name: 'Test cup holder', category: 'Luggage & suitcases', price: N(16_500), stock: 5 }, { name: 'Test eSIM', category: 'eSIMs & data plans', price: N(18_000), stock: null }]).returning();
    const u = await readyUser(150_000); const ops = await staff('shop_ops'); const finance = await staff('finance');
    const goal = (await u.api.post('/wallet/goals', { name: 'Travel shopping', kind: 'shopping', target: N(80_000) })).body;
    await u.api.post(`/wallet/goals/${goal.id}/move`, { amount: N(45_000), direction: 'in' }).expect(200);
    expect(((await http().get('/v1/shop/products?q=test%20back').expect(200)).body as { id: string }[]).map((p) => p.id)).toEqual([bag!.id]);
    const body = { items: [{ productId: bag!.id, qty: 1 }, { productId: holder!.id, qty: 1 }], delivery: 'standard', address, phone, goalId: goal.id, pin: '2580' };
    expect((await u.api.post('/shop/orders', { ...body, pin: '1111' }).expect(400)).body.code).toBe('pin_wrong');
    expect((await u.api.post('/shop/orders', { ...body, items: [{ productId: bag!.id, qty: 3 }] }).expect(409)).body.code).toBe('out_of_stock');
    const key = randomUUID();
    const order = (await u.api.post('/shop/orders', body, key).expect(201)).body;
    expect(order).toMatchObject({ status: 'placed', subtotal: N(111_500), deliveryFee: N(2_500), total: N(114_000), paidFromGoal: N(45_000), goalName: 'Travel shopping', repeated: false });
    expect((await u.api.post('/shop/orders', body, key).expect(201)).body).toMatchObject({ reference: order.reference, repeated: true });
    expect(await balance(u.api)).toMatchObject({ available: N(150_000 - 45_000 - 69_000), inGoals: 0 });
    expect((await http().get(`/v1/shop/products/${bag!.id}`)).body).toMatchObject({ inStock: true, lowStock: true });
    const digital = (await u.api.post('/shop/orders', { items: [{ productId: esim!.id, qty: 1 }], delivery: 'express', address, phone, pin: '2580' }).expect(201)).body;
    expect(digital).toMatchObject({ deliveryFee: 0, total: N(18_000), delivery: 'Sent by email' });
    expect((await u.api.post('/shop/orders', { items: [{ productId: bag!.id, qty: 1 }], delivery: 'standard', address, phone, pin: '2580' }).expect(400)).body.code).toBe('insufficient_funds');
    expect((await http().get(`/v1/shop/products/${bag!.id}`)).body.inStock).toBe(true); // the failed order did not take the last one

    await finance.post(`/shop/orders/${order.id}/status`, { status: 'packed' }).expect(403);
    await ops.post(`/shop/orders/${order.id}/status`, { status: 'delivered' }).expect(409);
    await ops.post(`/shop/orders/${order.id}/status`, { status: 'packed' }).expect(200);
    await ops.post(`/shop/orders/${order.id}/status`, { status: 'shipped' }).expect(200);
    expect((await u.api.get(`/shop/orders/${order.id}`)).body.status).toBe('shipped');
    expect((await u.api.get('/notifications')).body.items[0].text).toContain('is on its way');
    const before = (await balance(u.api)).available;
    await ops.post(`/shop/orders/${digital.id}/status`, { status: 'cancelled' }).expect(200);
    expect((await balance(u.api)).available).toBe(before + N(18_000));
    expect(((await ops.get('/shop/orders?status=shipped')).body.orders as { id: string }[]).some((o) => o.id === order.id)).toBe(true);
    expect(await ledger.audit()).toEqual({ entriesSum: 0, accountsOutOfStep: 0 });
  });
});

describe('staff manage products and places', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');
  it('lets Shop ops add, restock and hide a product with a photo', async () => {
    const ops = await staff('shop_ops'); const mod = await staff('moderator');
    await mod.get('/shop/products').expect(403);
    const up = await http().post('/v1/admin/uploads/products').set('Authorization', `Bearer ${ops.token}`).attach('file', png, { filename: 'p.png', contentType: 'image/png' }).expect(201);
    await http().post('/v1/admin/uploads/places').set('Authorization', `Bearer ${ops.token}`).attach('file', png, 'p.png').expect(403);
    expect((await ops.post('/shop/products', { name: 'X', category: 'Luggage & suitcases', price: N(10_000), stock: 1 }).expect(400)).body.code).toBe('invalid_input');
    const { id } = (await ops.post('/shop/products', { name: 'Compression packing cubes, set of 6', category: 'Packing cubes & organisers', price: N(14_500), stock: 3, imageUrl: up.body.url, description: 'Six sizes that squeeze the air out.' }).expect(201)).body;
    expect((await http().get(`/v1/shop/products/${id}`).expect(200)).body).toMatchObject({ price: N(14_500), imageUrl: up.body.url, lowStock: true });
    await ops.patch(`/shop/products/${id}`, { stock: 80, price: N(15_000) }).expect(200);
    const row = ((await ops.get('/shop/products')).body as { id: string; stock: number; active: boolean; sold30d: number }[]).find((p) => p.id === id);
    expect(row).toMatchObject({ stock: 80, active: true, sold30d: 0 });
    await ops.patch(`/shop/products/${id}`, { active: false }).expect(200);
    await http().get(`/v1/shop/products/${id}`).expect(404);
  });
  it('lets a moderator add a place, and keeps drafts out of the app', async () => {
    const mod = await staff('moderator'); const ops = await staff('shop_ops');
    await ops.post('/places', { name: 'Nope', kind: 'City', countryCode: 'NG', summary: 'Shop ops cannot add places to the app.' }).expect(403);
    const draft = (await mod.post('/places', { name: 'Cape Coast', kind: 'City', countryCode: 'gh', summary: 'Castles, fishing boats and the canopy walk at Kakum.', published: false }).expect(201)).body;
    expect(draft).toMatchObject({ id: 'cape-coast', countryCode: 'GH' });
    await http().get('/v1/places/cape-coast').expect(404);
    expect((await mod.post('/places', { name: 'Cape Coast', kind: 'City', countryCode: 'GH', summary: 'A second one with the same name.' }).expect(400)).body.code).toBe('place_exists');
    const row = ((await mod.get('/places')).body as { id: string; uuid: string; published: boolean }[]).find((p) => p.id === 'cape-coast')!;
    await mod.patch(`/places/${row.uuid}`, { published: true, bestTime: 'Nov – Mar' }).expect(200);
    expect((await http().get('/v1/places/cape-coast').expect(200)).body).toMatchObject({ name: 'Cape Coast', bestTime: 'Nov – Mar' });
  });
});

describe('staff: users, plans and the overview', () => {
  it('lets Support find a customer and act on the account', async () => {
    const u = await readyUser(40_000); await u.api.patch('/auth/me', { name: 'Kemi Bello' }); const support = await staff('support'); const mod = await staff('moderator');
    const found = (await support.get('/users?q=kemi%20bel').expect(200)).body;
    expect(found.users.find((x: { id: string }) => x.id === u.id)).toMatchObject({ name: 'Kemi Bello', kyc: 'verified', wallet: N(40_000), status: 'active' });
    expect(JSON.stringify(found)).not.toContain(u.email); // email addresses are masked
    const detail = (await support.get(`/users/${u.id}`).expect(200)).body;
    expect(detail).toMatchObject({ hasPin: true, wallet: { available: N(40_000), inGoals: 0 }, banks: [{ bank: 'GTBank', account: '•••• 4821' }] });
    await mod.post(`/users/${u.id}/action`, { action: 'freeze' }).expect(403); // moderators can look but not act
    expect((await support.post(`/users/${u.id}/action`, { action: 'freeze' }).expect(200)).body.walletFrozen).toBe(true);
    expect((await u.api.post('/wallet/withdrawals', { amount: N(5_000), source: 'available', pin: '2580' }).expect(403)).body.code).toBe('wallet_frozen');
    await support.post(`/users/${u.id}/action`, { action: 'unfreeze' }).expect(200);
    expect((await support.post(`/users/${u.id}/action`, { action: 'reset_pin' }).expect(200)).body.hasPin).toBe(false);
    expect((await u.api.post('/wallet/withdrawals', { amount: N(5_000), source: 'available', pin: '2580' }).expect(403)).body.code).toBe('pin_required');
    await u.api.put('/wallet/pin', { pin: '7391' }).expect(204);
    await support.post(`/users/${u.id}/action`, { action: 'suspend' }).expect(200);
    await u.api.get('/auth/me').expect(403);
    expect(((await support.get('/users?filter=suspended')).body.users as { id: string }[]).some((x) => x.id === u.id)).toBe(true);
    await support.post(`/users/${u.id}/action`, { action: 'reinstate' }).expect(200);
    await u.api.get('/auth/me').expect(200);
  });
  it('removes a plan and refunds buyers whose money has not been paid out', async () => {
    const seller = await named('Scam Seller'); await seller.api.post('/wallet/identity', { method: 'BVN', number: '22212345678', dateOfBirth: '1990-01-01' });
    const trip = (await seller.api.post('/trips', { title: 'Dubai on a zero visa', place: 'Dubai, UAE', countryCode: 'AE', startDate: '2026-08-01', endDate: '2026-08-05' }, null)).body;
    for (const t of ['08:00', '12:00', '18:00']) await seller.api.post(`/trips/${trip.id}/items`, { day: '2026-08-02', time: t, title: `Stop at ${t}` }, null);
    const plan = (await seller.api.put(`/trips/${trip.id}/plan`, { mode: 'sell', price: N(15_000) })).body;
    const buyer = await readyUser(20_000); const mod = await staff('moderator'); const finance = await staff('finance');
    await buyer.api.post(`/plans/${plan.id}/buy`, { pin: '2580' }).expect(200);
    expect((await balance(buyer.api)).available).toBe(N(5_000));
    expect(((await mod.get('/plans').expect(200)).body as { id: string; used: number }[]).find((p) => p.id === plan.id)).toMatchObject({ used: 1, status: 'on_sale' });
    await finance.post(`/plans/${plan.id}/remove`, { refund: true, reason: 'misleading' }).expect(403);
    await mod.post(`/plans/${plan.id}/remove`, { refund: true }).expect(400); // a removal needs a reason
    expect((await mod.post(`/plans/${plan.id}/remove`, { refund: true, reason: 'misleading', note: 'Nigerians need a visa for Dubai.' }).expect(200)).body).toMatchObject({ reason: 'Misleading: Nigerians need a visa for Dubai.', refunded: 1, total: N(15_000), alreadyPaidOut: 0 });
    await mod.post(`/plans/${plan.id}/remove`, { refund: true, reason: 'misleading' }).expect(409);
    expect((await seller.api.get('/notifications')).body.items[0].text).toContain('because it was misleading or inaccurate. Nigerians need a visa for Dubai.');
    expect(((await mod.get('/plans')).body as { id: string; removedReason: string }[]).find((p) => p.id === plan.id)!.removedReason).toBe('Misleading: Nigerians need a visa for Dubai.');
    expect((await balance(buyer.api)).available).toBe(N(20_000));
    await http().get(`/v1/plans/${plan.id}`).expect(404);
    expect(((await finance.get('/payouts')).body.sellers as { sellerId: string }[]).some((x) => x.sellerId === seller.id)).toBe(false); // nothing left to pay the seller
    expect((await buyer.api.get('/notifications')).body.items[0].text).toContain('returned ₦15,000 to your wallet');
    expect(await ledger.audit()).toEqual({ entriesSum: 0, accountsOutOfStep: 0 });
  });
  it('reports real totals on the overview', async () => {
    const boss = await staff('super_admin');
    const o = (await boss.get('/overview').expect(200)).body;
    expect(o.users.total).toBeGreaterThan(20); expect(o.signups).toHaveLength(8); expect(o.signups.at(-1).value).toBe(o.users.total);
    expect(o.money.heldForCustomers).toBeGreaterThan(0); expect(o.money.planFees).toBeGreaterThan(0);
    expect(o.attention).toMatchObject({ openReports: expect.any(Number), ordersToPack: expect.any(Number) });
    expect(o.activity[0]).toMatchObject({ action: expect.any(String) });
  });
});

describe('maps', () => {
  it('pins a place where staff put it and a trip on the matching place, or the middle of the country', async () => {
    const mod = await staff('moderator'); const u = await named('Map Maker');
    const name = `Zanzibar ${Date.now()}`;
    const made = (await mod.post('/places', { name, kind: 'Island', countryCode: 'TZ', summary: 'Spice farms, white sand and Stone Town alleys.', lat: -6.1659, lng: 39.2026 }).expect(201)).body;
    expect((await http().get(`/v1/places/${made.id}`).expect(200)).body).toMatchObject({ lat: -6.1659, lng: 39.2026, pinned: true });
    await mod.post('/places', { name: `${name} 2`, kind: 'Island', countryCode: 'TZ', summary: 'Spice farms, white sand and Stone Town alleys.', lat: 120, lng: 0 }).expect(400);
    const trip = (base: object) => u.api.post('/trips', { startDate: '2027-03-01', endDate: '2027-03-06', ...base }, null);
    expect((await trip({ title: 'Island week', place: `${name}, Tanzania`, countryCode: 'TZ' }).expect(201)).body).toMatchObject({ lat: -6.1659, lng: 39.2026 });
    expect((await trip({ title: 'Safari', place: 'Serengeti', countryCode: 'TZ' }).expect(201)).body).toMatchObject({ lat: -6, lng: 35 }); // no known place: centre of Tanzania
  });
});

describe('staff: notifications to travellers and platform settings', () => {
  it('sends a notification to an audience and counts who opened it', async () => {
    const boss = await staff('super_admin'); const finance = await staff('finance');
    const verified = await readyUser(1_000); const plain = await named('Plain Traveller');
    const before = (await boss.get('/broadcasts').expect(200)).body;
    expect(before.audiences.map((a: { id: string }) => a.id)).toEqual(['everyone', 'verified', 'travelling_soon', 'sellers', 'shoppers']);
    await finance.post('/broadcasts', { title: 'Hello', message: 'Finance cannot send these.', audience: 'everyone' }).expect(403);
    await boss.post('/broadcasts', { title: 'Hi', message: 'short', audience: 'everyone' }).expect(400);
    const sent = (await boss.post('/broadcasts', { title: 'Travelling in December?', message: 'Order your travel essentials by 4 December.', audience: 'verified', href: '/shop' }).expect(201)).body;
    expect(sent.recipients).toBe(before.audiences.find((a: { id: string }) => a.id === 'verified').people);
    const inbox = (await verified.api.get('/notifications')).body.items[0];
    expect(inbox).toMatchObject({ type: 'news', text: 'Travelling in December?\nOrder your travel essentials by 4 December.', href: '/shop' });
    expect(JSON.stringify((await plain.api.get('/notifications')).body)).not.toContain('Travelling in December?'); // not in the audience
    await verified.api.post('/notifications/read', {}, null);
    const row = ((await boss.get('/broadcasts')).body.sent as { id: string; opened: number; recipients: number; opens: string }[]).find((b) => b.id === sent.id)!;
    expect(row).toMatchObject({ recipients: sent.recipients, opened: 1, opens: 'Shop' });
  });
  it('applies settings staff change: delivery fees, the daily limit and the new-bank hold', async () => {
    const boss = await staff('super_admin'); const finance = await staff('finance'); const u = await readyUser(50_000);
    const start = (await finance.get('/settings').expect(200)).body; // Finance can look
    expect(start.locked.planFeePercent).toBe(25);
    await finance.patch('/settings', { holdNewBank: false }).expect(403); // but not change
    await boss.patch('/settings', { reportsToRereview: 0 }).expect(400);
    try {
      const saved = (await boss.patch('/settings', { deliveryStandardKobo: N(1_800), holdNewBank: false, dailyWithdrawalLimitKobo: N(4_000) }).expect(200)).body;
      expect(saved.settings).toMatchObject({ deliveryStandardKobo: N(1_800), holdNewBank: false, dailyWithdrawalLimitKobo: N(4_000) });
      expect(((await http().get('/v1/shop/delivery')).body as { id: string; fee: number }[]).find((d) => d.id === 'standard')!.fee).toBe(N(1_800));
      // the bank was added moments ago: with the hold off, a small withdrawal goes straight through
      expect((await u.api.post('/wallet/withdrawals', { amount: N(2_000), source: 'available', pin: '2580' }).expect(201)).body.status).toBe('processing');
      // and the lower daily limit now holds the next one
      expect((await u.api.post('/wallet/withdrawals', { amount: N(3_000), source: 'available', pin: '2580' }).expect(201)).body).toMatchObject({ status: 'held' });
    } finally { await boss.patch('/settings', start.settings).expect(200); }
    expect(((await http().get('/v1/shop/delivery')).body as { id: string; fee: number }[]).find((d) => d.id === 'standard')!.fee).toBe(start.settings.deliveryStandardKobo);
  });
  it('accepts a voice note recorded on a phone as sound, not video', async () => {
    const u = await named('Voice Tipper');
    const m4a = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(200)]); // Android records voice as plain MP4
    const up = (await http().post('/v1/media').set('Authorization', `Bearer ${u.token}`).attach('file', m4a, { filename: 'voice.m4a', contentType: 'audio/mp4' }).expect(201)).body;
    expect(up.kind).toBe('audio');
    const tip = (await u.api.post('/tips', { title: 'Listen before you land in Accra', place: 'Accra, Ghana', countryCode: 'GH', category: 'Getting there', format: 'voice', body: '', mediaId: up.id }, null).expect(201)).body;
    expect(tip).toMatchObject({ format: 'voice', media: { kind: 'audio' } });
  });
});

describe('timed jobs', () => {
  const day = (offset: number) => new Date(Date.now() + 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10); // Lagos calendar day
  const texts = async (api: ReturnType<typeof authed>) => ((await api.get('/notifications')).body.items as { text: string }[]).map((n) => n.text);
  it('reminds a traveller a week before a trip, once', async () => {
    const jobs = app.get(JobsService); const u = await named('Reminder Rita');
    await u.api.post('/trips', { title: 'Zanzibar week', place: 'Zanzibar', countryCode: 'TZ', startDate: day(7), endDate: day(12) }, null).expect(201);
    await u.api.post('/trips', { title: 'Far away', place: 'Lima', countryCode: 'PE', startDate: day(40), endDate: day(45) }, null).expect(201);
    expect((await jobs.run('trip_reminders', true)).did).toBeGreaterThanOrEqual(1);
    await jobs.run('trip_reminders', true);
    const got = (await texts(u.api)).filter((t) => t.startsWith('One week to go'));
    expect(got).toHaveLength(1); expect(got[0]).toContain('Zanzibar week starts on');
  });
  it('sends a scheduled notification when its time comes, and lets staff cancel one', async () => {
    const jobs = app.get(JobsService); const boss = await staff('super_admin'); const u = await named('Scheduled Sam');
    const soon = new Date(Date.now() + 3_600_000).toISOString();
    await boss.post('/broadcasts', { title: 'Too soon', message: 'This time has already passed.', audience: 'everyone', sendAt: new Date(Date.now() - 60_000).toISOString() }).expect(400);
    const later = (await boss.post('/broadcasts', { title: 'Detty December', message: 'Flights fill up fast. Plan your trip now.', audience: 'everyone', sendAt: soon }).expect(201)).body;
    const dropped = (await boss.post('/broadcasts', { title: 'Never mind', message: 'This one gets cancelled first.', audience: 'everyone', sendAt: soon }).expect(201)).body;
    expect(later.recipients).toBe(0);
    await jobs.run('scheduled_notifications', true);
    expect(await texts(u.api)).not.toContain('Detty December\nFlights fill up fast. Plan your trip now.'); // not yet
    await boss.post(`/broadcasts/${dropped.id}/cancel`).expect(200);
    await boss.post(`/broadcasts/${dropped.id}/cancel`).expect(409);
    await db.execute(sql`UPDATE broadcasts SET send_at = now() - interval '1 minute' WHERE id IN (${later.id}::uuid, ${dropped.id}::uuid)`);
    expect((await jobs.run('scheduled_notifications', true)).did).toBe(1);
    const inbox = await texts(u.api);
    expect(inbox).toContain('Detty December\nFlights fill up fast. Plan your trip now.'); expect(inbox.join()).not.toContain('Never mind');
    const rows = (await boss.get('/broadcasts')).body.sent as { id: string; status: string; recipients: number }[];
    expect(rows.find((r) => r.id === later.id)).toMatchObject({ status: 'sent' }); expect(rows.find((r) => r.id === later.id)!.recipients).toBeGreaterThan(0);
    expect(rows.find((r) => r.id === dropped.id)).toMatchObject({ status: 'cancelled', recipients: 0 });
  });
  it('counts a notification as read when the traveller taps it', async () => {
    const boss = await staff('super_admin'); const u = await named('Tapping Tayo');
    const sent = (await boss.post('/broadcasts', { title: 'Tap me', message: 'Tapping this counts as read.', audience: 'everyone' }).expect(201)).body;
    const item = ((await u.api.get('/notifications')).body.items as { id: string; text: string; read: boolean }[]).find((n) => n.text.startsWith('Tap me'))!;
    expect(item.read).toBe(false);
    await u.api.post(`/notifications/${item.id}/read`, {}, null).expect(204);
    expect(((await boss.get('/broadcasts')).body.sent as { id: string; opened: number }[]).find((b) => b.id === sent.id)!.opened).toBe(1);
  });
  it('moves the planned amount into a goal, never overdraws, and never does it twice in a day', async () => {
    const jobs = app.get(JobsService); const rich = await readyUser(20_000); const broke = await readyUser(1_000);
    const goal = async (u: typeof rich) => { const g = (await u.api.post('/wallet/goals', { name: 'Ghana in March', kind: 'trip', target: N(50_000), autoSaveAmount: N(2_000), autoSaveFrequency: 'daily' }).expect(201)).body;
      await db.execute(sql`UPDATE savings_goals SET created_at = now() - interval '3 days' WHERE id = ${g.id}::uuid`); return g.id as string; };
    const a = await goal(rich); await goal(broke);
    await jobs.run('auto_save', true); await jobs.run('auto_save', true);
    expect((await balance(rich.api)).available).toBe(N(18_000));
    expect(((await rich.api.get('/wallet/goals')).body as { id: string; saved: number }[]).find((g) => g.id === a)!.saved).toBe(N(2_000));
    expect((await texts(rich.api))[0]).toBe('₦2,000 moved into Ghana in March, as you planned.');
    expect((await balance(broke.api)).available).toBe(N(1_000));
    expect((await texts(broke.api)).filter((t) => t.includes('wallet balance is too low'))).toHaveLength(1);
    expect(await ledger.audit()).toEqual({ entriesSum: 0, accountsOutOfStep: 0 });
  });
  it('tells a seller when their plan goes on sale, and reports each job to the console', async () => {
    const jobs = app.get(JobsService); const boss = await staff('super_admin'); const mod = await staff('moderator');
    const seller = await named('Seller Sade'); await seller.api.post('/wallet/identity', { method: 'BVN', number: '22212345678', dateOfBirth: '1990-01-01' });
    const trip = (await seller.api.post('/trips', { title: 'Cape Town on a budget', place: 'Cape Town', countryCode: 'ZA', startDate: day(-9), endDate: day(-2) }, null)).body;
    for (const t of ['08:00', '12:00', '18:00']) await seller.api.post(`/trips/${trip.id}/items`, { day: day(-5), time: t, title: `Stop at ${t}` }, null);
    await seller.api.put(`/trips/${trip.id}/plan`, { mode: 'sell', price: N(4_500) }).expect(200);
    await jobs.run('plan_on_sale', true); await jobs.run('plan_on_sale', true);
    expect((await texts(seller.api)).filter((t) => t.startsWith('Your plan "Cape Town on a budget" is now on sale for ₦4,500'))).toHaveLength(1);
    await mod.get('/jobs').expect(403);
    const status = (await boss.get('/jobs').expect(200)).body;
    expect(status.jobs.map((j: { name: string }) => j.name)).toEqual(['scheduled_notifications', 'plan_on_sale', 'calendar_sync', 'trip_reminders', 'auto_save', 'goal_reminders', 'cleanup']);
    expect(status.jobs.find((j: { name: string }) => j.name === 'plan_on_sale')).toMatchObject({ problem: null, lastOkAt: expect.any(String) });
    expect((await boss.post('/jobs/cleanup/run').expect(200)).body.ran).toBe(true);
    await boss.post('/jobs/nonsense/run').expect(404);
  });
});

describe('place search', () => {
  it('suggests our own places first, then the map, and pins the trip exactly where the traveller chose', async () => {
    const mod = await staff('moderator'); const u = await named('Searching Seyi');
    const name = `Lekki${Date.now()}`;
    await mod.post('/places', { name, kind: 'City', countryCode: 'NG', summary: 'Beaches, art markets and the conservation centre.', lat: 6.4698, lng: 3.5852 }).expect(201);
    geocoder.features = [{ geometry: { coordinates: [-0.186964, 5.603717] }, properties: { name: 'Accra', country: 'Ghana', countrycode: 'GH', state: 'Greater Accra Region', type: 'city' } },
      { geometry: { coordinates: [-0.2, 5.6] }, properties: { name: 'Accra Road', country: 'Ghana', countrycode: 'GH', type: 'street' } }];
    const hits = (await u.api.get(`/geo/search?q=${name.slice(0, 8)}`).expect(200)).body;
    expect(hits[0]).toMatchObject({ name, label: `${name}, Nigeria`, countryCode: 'NG', lat: 6.4698, source: 'everycation' });
    expect(hits[1]).toMatchObject({ name: 'Accra', label: 'Accra, Ghana', detail: 'Greater Accra Region, Ghana', countryCode: 'GH', lat: 5.60372, lng: -0.18696, source: 'map' });
    expect(hits).toHaveLength(2); // the street is left out
    expect(geocoder.asked.at(-1)).toContain(name.slice(0, 8));
    const trip = (await u.api.post('/trips', { title: 'Jollof tour', place: 'Accra, Ghana', countryCode: 'GH', startDate: '2027-05-01', endDate: '2027-05-04', lat: 5.60372, lng: -0.18696 }, null).expect(201)).body;
    expect(trip).toMatchObject({ lat: 5.60372, lng: -0.18696, pinned: true });
    geocoder.down = true; // the map service failing must not break search
    expect((await u.api.get(`/geo/search?q=${name.slice(0, 7)}`).expect(200)).body).toHaveLength(1);
    geocoder.down = false;
    await http().get('/v1/geo/search?q=accra').expect(401);
  });
});

describe('sign in with Google or Apple, and Google Calendar', () => {
  /** Follows the two browser hops of a Google sign-in and returns where the browser ends up. */
  async function throughGoogle(startUrl: string, who: Partial<GoogleTokens>) {
    const google = app.get(GoogleApi);
    google.exchangeCode = async () => ({ sub: 'g-1', email: null, emailVerified: true, name: null, refreshToken: null, accessToken: 'access', ...who });
    const state = new URL(startUrl).searchParams.get('state')!;
    return new URL((await http().get(`/v1/auth/google/callback?code=from-google&state=${encodeURIComponent(state)}`).expect(302)).headers.location!);
  }
  it('signs in with Google and keeps the same account as an earlier email sign-in', async () => {
    expect((await http().get('/v1/auth/providers').expect(200)).body).toEqual({ google: true, apple: true, calendar: true });
    const before = await signUp(); // the same person signed in with an email code first
    await http().get('/v1/auth/google/start?returnTo=https://evil.example/catch').expect(400);
    const start = (await http().get('/v1/auth/google/start?returnTo=everycation://signed-in').expect(302)).headers.location!;
    expect(start).toContain('https://accounts.google.com/o/oauth2/v2/auth?'); expect(start).toContain('client_id=test-google-client'); expect(start).toContain('scope=openid+email+profile');
    const back = await throughGoogle(start, { sub: `g-${before.id}`, email: before.email, name: 'Ada Google' });
    expect(back.protocol).toBe('everycation:'); const code = back.searchParams.get('code')!;
    const session = (await http().post('/v1/auth/handoff').send({ code }).expect(200)).body;
    expect((await authed(session.accessToken).get('/auth/me')).body).toMatchObject({ id: before.id, name: 'Ada Google' });
    await http().post('/v1/auth/handoff').send({ code }).expect(400); // a code works once
    // someone who says no at Google comes back with an error, not a session
    const state = new URL(start).searchParams.get('state')!;
    expect(new URL((await http().get(`/v1/auth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`).expect(302)).headers.location!).searchParams.get('error')).toBe('cancelled');
    // an unconfirmed Google email must not take over an existing account
    const other = await signUp();
    const sneaky = await throughGoogle(start, { sub: `g-sneaky-${other.id}`, email: other.email, emailVerified: false });
    const s2 = (await http().post('/v1/auth/handoff').send({ code: sneaky.searchParams.get('code') }).expect(200)).body;
    expect((await authed(s2.accessToken).get('/auth/me')).body.id).not.toBe(other.id);
  });
  it('signs in with Apple', async () => {
    const apple = app.get(AppleVerifier); const sub = `apple-${randomUUID()}`;
    apple.verify = async (token: string) => { if (token !== 'a-real-identity-token-from-apple') throw Object.assign(new Error('bad'), { status: 400 }); return { sub, email: `${sub}@privaterelay.appleid.com`, emailVerified: true }; };
    const first = (await http().post('/v1/auth/apple').send({ identityToken: 'a-real-identity-token-from-apple', name: 'Bisi Apple' }).expect(200)).body;
    expect(first.isNewUser).toBe(false); // Apple gave us the name, so there is nothing more to ask
    const me = (await authed(first.accessToken).get('/auth/me')).body; expect(me.name).toBe('Bisi Apple');
    const again = (await http().post('/v1/auth/apple').send({ identityToken: 'a-real-identity-token-from-apple' }).expect(200)).body; // Apple only sends the name the first time
    expect((await authed(again.accessToken).get('/auth/me')).body.id).toBe(me.id);
  });
  it('copies trips into Google Calendar, updates them, and stops when disconnected', async () => {
    const google = app.get(GoogleApi); const u = await named('Calendar Chidi');
    const saved: { calendarId: string; eventId: string | null; event: CalendarEvent }[] = []; let revoked = '';
    google.createCalendar = async () => 'cal-123'; google.accessToken = async (refresh) => `access-for-${refresh}`; google.revoke = async (t) => { revoked = t; };
    google.saveEvent = async (_a, calendarId, eventId, event) => { saved.push({ calendarId, eventId, event }); return eventId ?? `event-${saved.length}`; };
    const trip = (await u.api.post('/trips', { title: 'Lagos to Zanzibar', place: 'Zanzibar, Tanzania', countryCode: 'TZ', startDate: '2027-01-10', endDate: '2027-01-15' }, null).expect(201)).body;
    expect((await u.api.get('/calendar').expect(200)).body).toMatchObject({ available: true, connected: false });
    const { url } = (await u.api.post('/calendar/google/connect', { returnTo: 'everycation://travels' }, null).expect(200)).body;
    expect(decodeURIComponent(url)).toContain('https://www.googleapis.com/auth/calendar.app.created'); expect(url).toContain('access_type=offline');
    const back = await throughGoogle(url, { email: 'chidi@gmail.com', refreshToken: 'refresh-1' });
    expect(back.searchParams.get('calendar')).toBe('connected');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ calendarId: 'cal-123', eventId: null, event: { summary: 'Lagos to Zanzibar', location: 'Zanzibar, Tanzania', startDate: '2027-01-10', endDateExclusive: '2027-01-16' } });
    expect(JSON.stringify((await db.execute(sql`SELECT refresh_token FROM calendar_links WHERE user_id = ${u.id}::uuid`)).rows)).not.toContain('refresh-1'); // stored encrypted
    expect((await u.api.get('/calendar')).body).toMatchObject({ connected: true, account: 'chidi@gmail.com', waiting: 0, problem: null });
    await u.api.post(`/trips/${trip.id}/items`, { day: '2027-01-11', time: '09:30', title: 'Spice farm tour', note: 'Bring cash' }, null).expect(201);
    await expect.poll(() => saved.length).toBe(2); // the change follows without the traveller waiting for it
    expect(saved[1]).toMatchObject({ eventId: 'event-1' }); expect(saved[1]!.event.description).toContain('Mon 11 Jan 09:30  Spice farm tour (Bring cash)');
    // Google being down leaves the trip waiting, and the timed job picks it up later
    google.saveEvent = async () => { throw Object.assign(new Error('Google is down'), { status: 503 }); };
    await u.api.patch(`/trips/${trip.id}`, { title: 'Zanzibar with friends' }).expect(200);
    await expect.poll(async () => (await u.api.get('/calendar')).body.problem).toContain('try again');
    google.saveEvent = async (_a, calendarId, eventId, event) => { saved.push({ calendarId, eventId, event }); return eventId!; };
    expect((await app.get(JobsService).run('calendar_sync', true)).did).toBeGreaterThanOrEqual(1);
    expect(saved.at(-1)!.event.summary).toBe('Zanzibar with friends');
    expect((await u.api.get('/calendar')).body).toMatchObject({ waiting: 0, problem: null });
    expect((await http().delete('/v1/calendar/google').set('Authorization', `Bearer ${u.token}`).expect(200)).body.connected).toBe(false);
    expect(revoked).toBe('refresh-1');
  });
});
