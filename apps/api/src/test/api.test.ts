import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../db/db.module.js';
import { bankAccounts, ledgerAccounts, outbox } from '../db/schema.js';
import { createApp } from '../main.js';
import { Ledger } from '../modules/wallet/ledger.service.js';
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
