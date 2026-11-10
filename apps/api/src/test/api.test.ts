import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../db/db.module.js';
import { bankAccounts, ledgerAccounts, outbox, places } from '../db/schema.js';
import { createApp } from '../main.js';
import { Ledger } from '../modules/wallet/ledger.service.js';
import { AdminAuthService, type AdminRole } from '../modules/admin/admin-auth.js';
import { totpCode } from '../modules/admin/totp.js';
import { WalletService } from '../modules/wallet/wallet.service.js';
import { signPayload } from '../modules/wallet/webhook.controller.js';

let app: NestExpressApplication; let db: Database['db']; let wallet: WalletService; let ledger: Ledger;
let phoneSeq = 0;
const N = (naira: number) => naira * 100;
const http = () => request(app.getHttpServer());
const authed = (token: string) => ({
  get: (p: string) => http().get(`/v1${p}`).set('Authorization', `Bearer ${token}`),
  post: (p: string, body?: object, key: string | null = randomUUID()) => { const r = http().post(`/v1${p}`).set('Authorization', `Bearer ${token}`); if (key) r.set('Idempotency-Key', key); return r.send(body); },
  put: (p: string, body: object) => http().put(`/v1${p}`).set('Authorization', `Bearer ${token}`).send(body),
  patch: (p: string, body: object) => http().patch(`/v1${p}`).set('Authorization', `Bearer ${token}`).send(body),
});

async function signUp() {
  const phone = `80${String(30000000 + ++phoneSeq)}`;
  const asked = await http().post('/v1/auth/otp/request').send({ phone });
  const res = await http().post('/v1/auth/otp/verify').send({ phone, code: asked.body.devCode });
  const me = await authed(res.body.accessToken).get('/auth/me');
  return { phone, token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, id: me.body.id as string };
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

beforeAll(async () => { app = await createApp(); await app.init(); db = app.get(Database).db; wallet = app.get(WalletService); ledger = app.get(Ledger); });
afterAll(async () => { await app.close(); });

describe('sign-in', () => {
  it('signs up with a phone code and returns the profile', async () => {
    const u = await signUp();
    const me = await authed(u.token).get('/auth/me').expect(200);
    expect(me.body).toMatchObject({ phone: `+234${u.phone}`, kycStatus: 'none', hasPin: false });
  });
  it('rejects a wrong code, a second request inside a minute, and missing tokens', async () => {
    const phone = '8039990001';
    await http().post('/v1/auth/otp/request').send({ phone }).expect(200);
    expect((await http().post('/v1/auth/otp/verify').send({ phone, code: '000000' }).expect(400)).body.code).toBe('otp_wrong');
    expect((await http().post('/v1/auth/otp/request').send({ phone }).expect(429)).body.code).toBe('otp_wait');
    await http().post('/v1/auth/otp/request').send({ phone: '12345' }).expect(400);
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
  return { email, password, totpSecret, get: (p: string) => http().get(`/v1/admin${p}`).set(h), post: (p: string, body?: object) => http().post(`/v1/admin${p}`).set(h).send(body) };
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
    await mod.post('/reports/decision', { targetType: 'comment', targetId: comment.id, decision: 'remove' }).expect(200);
    expect((await http().get(`/v1/tips/${other.id}`)).body.comments).toBe(0);
    expect((await mod.post('/reports/decision', { targetType: 'tip', targetId: tip.id, decision: 'remove', suspendAuthor: true }).expect(200)).body).toMatchObject({ reportsClosed: 2, suspended: true });
    await mod.post('/reports/decision', { targetType: 'tip', targetId: tip.id, decision: 'remove' }).expect(409);
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
