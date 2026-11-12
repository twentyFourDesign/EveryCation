import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { RULES } from '../../config.js';
import { badRequest, conflict, forbidden, notFound, tooMany } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { Database, type Tx } from '../../db/db.module.js';
import { bankAccounts, ledgerAccounts, ledgerEntries, ledgerTransactions, outbox, savingsGoals, users, withdrawals } from '../../db/schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { Ledger, newReference } from './ledger.service.js';
import { BankDirectory, IdentityVerifier, namesMatch } from './partners.js';

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
/** Midnight today in Lagos (WAT is UTC+1 all year). */
const startOfLagosDay = () => { const d = new Date(Date.now() + 3_600_000); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 3_600_000); };
const WEAK_PINS = new Set(['1234', '0000', '1111', '4321', '2222', '1212']);

export interface GoalInput { name: string; kind: 'trip' | 'shopping' | 'package'; target: number; targetDate?: string; locked?: boolean; autoSaveAmount?: number; autoSaveFrequency?: 'daily' | 'weekly' | 'monthly' }

@Injectable()
export class WalletService {
  constructor(private readonly database: Database, private readonly ledger: Ledger, private readonly identity: IdentityVerifier, private readonly banks: BankDirectory, private readonly settings: SettingsService) {}
  private get db() { return this.database.db; }

  private async user(userId: string, tx: Tx | Database['db'] = this.db) {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (!u) throw notFound('Account');
    return u;
  }

  // ───────────── Setup: identity, PIN, bank ─────────────

  async verifyIdentity(userId: string, input: { method: 'BVN' | 'NIN'; number: string; dateOfBirth: string }) {
    const u = await this.user(userId);
    if (u.kycStatus === 'verified') return { status: 'verified' as const };
    if (u.kycAttempts >= 5) throw tooMany('kyc_locked', 'Too many tries. Contact support to finish your identity check.');
    const result = await this.identity.verify(input);
    await this.db.update(users).set(result.matched
      ? { kycStatus: 'verified', kycMethod: input.method, legalName: result.legalName, kycAttempts: u.kycAttempts + 1 }
      : { kycStatus: 'failed', kycAttempts: u.kycAttempts + 1 }).where(eq(users.id, userId));
    if (!result.matched) throw badRequest('kyc_failed', `We could not confirm your identity. ${result.reason ?? ''} Check your details and try again.`.replace('  ', ' '));
    return { status: 'verified' as const };
  }

  async setPin(userId: string, pin: string, currentPin?: string) {
    if (!/^\d{4}$/.test(pin)) throw badRequest('pin_invalid', 'Your PIN has 4 digits.');
    if (WEAK_PINS.has(pin)) throw badRequest('pin_weak', 'Choose a PIN that is harder to guess.');
    const u = await this.user(userId);
    if (u.kycStatus !== 'verified') throw forbidden('kyc_required', 'Confirm your identity before you create a PIN.');
    if (u.pinHash) { if (!currentPin) throw badRequest('pin_current_required', 'Enter your current PIN to change it.'); await this.checkPin(userId, currentPin); }
    await this.db.update(users).set({ pinHash: await argon2.hash(pin, { type: argon2.argon2id }), pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(users.id, userId));
  }

  /** Three wrong tries lock the PIN for 15 minutes. */
  async checkPin(userId: string, pin: string) {
    const u = await this.user(userId);
    if (!u.pinHash) throw forbidden('pin_required', 'Create your wallet PIN first.');
    if (u.pinLockedUntil && u.pinLockedUntil > new Date()) throw tooMany('pin_locked', 'Too many wrong tries. Try again in a few minutes or reset your PIN.', { retryAt: u.pinLockedUntil.toISOString() });
    if (await argon2.verify(u.pinHash, pin)) {
      if (u.pinFailedAttempts) await this.db.update(users).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(users.id, userId));
      return;
    }
    const failed = (u.pinLockedUntil ? 0 : u.pinFailedAttempts) + 1;
    const locked = failed >= RULES.pinMaxAttempts;
    await this.db.update(users).set({ pinFailedAttempts: locked ? 0 : failed, pinLockedUntil: locked ? new Date(Date.now() + RULES.pinLockMinutes * 60_000) : null }).where(eq(users.id, userId));
    if (locked) throw tooMany('pin_locked', 'Too many wrong tries. Try again in a few minutes or reset your PIN.');
    throw badRequest('pin_wrong', 'That PIN is not right. Try again.', { triesLeft: RULES.pinMaxAttempts - failed });
  }

  async addBank(userId: string, bankName: string, accountNumber: string) {
    const u = await this.user(userId);
    if (u.kycStatus !== 'verified' || !u.legalName) throw forbidden('kyc_required', 'Confirm your identity before you link a bank account.');
    const found = await this.banks.resolve(bankName, accountNumber);
    if (!found) throw badRequest('bank_not_found', 'We could not find that account. Check the bank and number.');
    if (!namesMatch(found.accountName, u.legalName)) throw badRequest('bank_name_mismatch', 'That account is in a different name. Link an account in your own name.');
    const existing = await this.db.select({ id: bankAccounts.id }).from(bankAccounts).where(and(eq(bankAccounts.userId, userId), isNull(bankAccounts.removedAt)));
    try {
      const [row] = await this.db.insert(bankAccounts).values({ userId, bankName, accountNumber, accountName: found.accountName, isDefault: existing.length === 0 }).returning();
      return this.bankView(row!);
    } catch { throw conflict('bank_exists', 'You have already linked that account.'); }
  }
  private bankView(b: typeof bankAccounts.$inferSelect) { return { id: b.id, bankName: b.bankName, last4: b.accountNumber.slice(-4), accountName: b.accountName, isDefault: b.isDefault, addedAt: b.createdAt }; }

  async setFrozen(userId: string, frozen: boolean) { await this.db.update(users).set({ walletFrozen: frozen }).where(eq(users.id, userId)); return { walletFrozen: frozen }; }

  // ───────────── Reading ─────────────

  async overview(userId: string) {
    const u = await this.user(userId);
    const [available] = await this.db.select({ balance: ledgerAccounts.balance }).from(ledgerAccounts).where(and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.kind, 'user_available')));
    const goals = await this.goals(userId);
    const banks = await this.db.select().from(bankAccounts).where(and(eq(bankAccounts.userId, userId), isNull(bankAccounts.removedAt)));
    const inGoals = goals.reduce((n, g) => n + g.saved, 0);
    return {
      available: available?.balance ?? 0, inGoals, total: (available?.balance ?? 0) + inGoals, goals, banks: banks.map((b) => this.bankView(b)),
      setup: { identity: u.kycStatus, hasPin: !!u.pinHash, hasBank: banks.length > 0, ready: u.kycStatus === 'verified' && !!u.pinHash && banks.length > 0 },
      frozen: u.walletFrozen, dailyWithdrawalLimit: (await this.settings.get()).dailyWithdrawalLimitKobo,
    };
  }

  async goals(userId: string) {
    const rows = await this.db.select({ g: savingsGoals, saved: ledgerAccounts.balance }).from(savingsGoals).innerJoin(ledgerAccounts, eq(ledgerAccounts.id, savingsGoals.accountId))
      .where(and(eq(savingsGoals.userId, userId), isNull(savingsGoals.closedAt))).orderBy(savingsGoals.createdAt);
    return rows.map(({ g, saved }) => ({ id: g.id, name: g.name, kind: g.kind, target: g.target, saved, percent: Math.min(100, Math.floor((saved / g.target) * 100)), targetDate: g.targetDate, locked: g.locked,
      autoSave: g.autoSaveAmount && g.autoSaveFrequency ? { amount: g.autoSaveAmount, frequency: g.autoSaveFrequency } : null }));
  }

  async history(userId: string, opts: { before?: Date; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 30, 100);
    const txns = await this.db.select().from(ledgerTransactions).where(and(eq(ledgerTransactions.userId, userId), opts.before ? lt(ledgerTransactions.createdAt, opts.before) : undefined)).orderBy(desc(ledgerTransactions.createdAt)).limit(limit);
    if (txns.length === 0) return { items: [], nextBefore: null };
    const moves = await this.db.select({ txnId: ledgerEntries.transactionId, amount: ledgerEntries.amount, kind: ledgerAccounts.kind, goal: savingsGoals.name }).from(ledgerEntries)
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId)).leftJoin(savingsGoals, eq(savingsGoals.accountId, ledgerAccounts.id))
      .where(and(inArray(ledgerEntries.transactionId, txns.map((t) => t.id)), eq(ledgerAccounts.userId, userId)));
    return {
      items: txns.map((t) => ({ reference: t.reference, kind: t.kind, description: t.description, at: t.createdAt,
        movements: moves.filter((m) => m.txnId === t.id).map((m) => ({ account: m.kind === 'goal' ? (m.goal ?? 'Goal') : 'Available balance', amount: m.amount })) })),
      nextBefore: txns.length === limit ? txns.at(-1)!.createdAt : null,
    };
  }

  // ───────────── Goals ─────────────

  async createGoal(userId: string, input: GoalInput) {
    if (input.target < RULES.minMoneyKobo) throw badRequest('target_too_low', `Set a target of at least ${naira(RULES.minMoneyKobo)}.`);
    const id = await this.db.transaction(async (tx) => {
      const [account] = await tx.insert(ledgerAccounts).values({ kind: 'goal', userId }).returning({ id: ledgerAccounts.id });
      const [goal] = await tx.insert(savingsGoals).values({ userId, accountId: account!.id, name: input.name.trim(), kind: input.kind, target: input.target, targetDate: input.targetDate, locked: input.locked ?? false, autoSaveAmount: input.autoSaveAmount, autoSaveFrequency: input.autoSaveFrequency }).returning({ id: savingsGoals.id });
      return goal!.id;
    });
    return (await this.goals(userId)).find((g) => g.id === id)!;
  }

  async updateGoal(userId: string, goalId: string, patch: Partial<Pick<GoalInput, 'name' | 'target' | 'targetDate' | 'locked'>>) {
    const [g] = await this.db.update(savingsGoals).set(patch).where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId), isNull(savingsGoals.closedAt))).returning({ id: savingsGoals.id });
    if (!g) throw notFound('Goal');
    return (await this.goals(userId)).find((x) => x.id === goalId)!;
  }

  private async goalIn(tx: Tx, userId: string, goalId: string) {
    const [g] = await tx.select().from(savingsGoals).where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId), isNull(savingsGoals.closedAt)));
    if (!g) throw notFound('Goal');
    return g;
  }
  private assertAmount(amount: number) {
    if (!Number.isSafeInteger(amount) || amount < RULES.minMoneyKobo) throw badRequest('amount_too_low', `Enter an amount of at least ${naira(RULES.minMoneyKobo)}.`);
  }

  /** Moves money between the available balance and a goal. Locked goals only take money in. */
  async moveToGoal(userId: string, goalId: string, amount: number, direction: 'in' | 'out', idempotencyKey?: string) {
    this.assertAmount(amount);
    return this.ledger.run(async (tx) => {
      const repeat = await this.ledger.findByKey(tx, userId, idempotencyKey);
      if (repeat) return { reference: repeat.reference, repeated: true };
      const u = await this.user(userId, tx);
      const goal = await this.goalIn(tx, userId, goalId);
      if (direction === 'out' && goal.locked) throw forbidden('goal_locked', `${goal.name} is locked. Unlock it first to take money out.`);
      if (direction === 'out' && u.walletFrozen) throw forbidden('wallet_frozen', 'Your wallet is frozen. Unfreeze it in Wallet settings first.');
      const available = await this.ledger.availableAccount(tx, userId);
      const reference = newReference('GL');
      await this.ledger.post(tx, { kind: direction === 'in' ? 'goal_in' : 'goal_out', reference, userId, idempotencyKey, description: direction === 'in' ? `Moved to ${goal.name}` : `Moved out of ${goal.name}`,
        entries: direction === 'in' ? [{ accountId: available, amount: -amount }, { accountId: goal.accountId, amount }] : [{ accountId: goal.accountId, amount: -amount }, { accountId: available, amount }] });
      return { reference, repeated: false };
    });
  }

  // ───────────── Money in ─────────────

  /** Credits a bank transfer or card payment the partner has confirmed. Called from the signed webhook only. */
  async creditDeposit(input: { userId: string; amount: number; partnerReference: string; goalId?: string; channel: 'transfer' | 'card' }) {
    this.assertAmount(input.amount);
    return this.ledger.run(async (tx) => {
      const [dup] = await tx.select({ id: ledgerTransactions.id }).from(ledgerTransactions).where(eq(ledgerTransactions.reference, input.partnerReference));
      if (dup) return { credited: false };
      await this.user(input.userId, tx);
      const goal = input.goalId ? await this.goalIn(tx, input.userId, input.goalId) : null;
      const to = goal ? goal.accountId : await this.ledger.availableAccount(tx, input.userId);
      const from = await this.ledger.systemAccount(tx, input.channel === 'card' ? 'card_clearing' : 'partner_float');
      await this.ledger.post(tx, { kind: 'deposit', reference: input.partnerReference, userId: input.userId, description: goal ? `Added to ${goal.name}` : input.channel === 'card' ? 'Card payment in' : 'Bank transfer in',
        metadata: { channel: input.channel }, entries: [{ accountId: from, amount: -input.amount }, { accountId: to, amount: input.amount }] });
      await notify(tx, input.userId, 'wallet', `${naira(input.amount)} arrived in ${goal ? goal.name : 'your available balance'}.`, '/wallet/history');
      await tx.insert(outbox).values({ topic: 'wallet.deposit', payload: { userId: input.userId, amount: input.amount, goalId: input.goalId ?? null } });
      return { credited: true };
    });
  }

  // ───────────── Money out ─────────────

  /**
   * Withdraws to the customer's bank. The money leaves their balance at once and waits in
   * payout clearing until the partner confirms the transfer (or it is returned).
   * Over the daily limit, or to a bank added in the last 24 hours, the request is held for Finance.
   */
  async withdraw(userId: string, input: { amount: number; source: 'available' | string; bankAccountId?: string; pin: string }, idempotencyKey?: string) {
    this.assertAmount(input.amount);
    const before = await this.user(userId);
    if (before.kycStatus !== 'verified') throw forbidden('kyc_required', 'Confirm your identity before you withdraw.');
    if (idempotencyKey) { const [w] = await this.db.select().from(withdrawals).innerJoin(ledgerTransactions, eq(ledgerTransactions.id, withdrawals.transactionId)).where(and(eq(ledgerTransactions.idempotencyKey, idempotencyKey), eq(withdrawals.userId, userId))); if (w) return this.withdrawalView(w.withdrawals, true); }
    await this.checkPin(userId, input.pin);

    const row = await this.ledger.run(async (tx) => {
      const repeat = await this.ledger.findByKey(tx, userId, idempotencyKey);
      if (repeat) { const [w] = await tx.select().from(withdrawals).where(eq(withdrawals.transactionId, repeat.id)); return { w: w!, repeated: true }; }
      const u = await this.user(userId, tx);
      if (u.walletFrozen) throw forbidden('wallet_frozen', 'Your wallet is frozen. Unfreeze it in Wallet settings first.');

      const [bank] = await tx.select().from(bankAccounts).where(and(eq(bankAccounts.userId, userId), isNull(bankAccounts.removedAt), input.bankAccountId ? eq(bankAccounts.id, input.bankAccountId) : eq(bankAccounts.isDefault, true)));
      if (!bank) throw badRequest('bank_required', 'Link a bank account before you withdraw.');

      let source: string; let from = 'available balance';
      if (input.source === 'available') source = await this.ledger.availableAccount(tx, userId);
      else { const goal = await this.goalIn(tx, userId, input.source); if (goal.locked) throw forbidden('goal_locked', `${goal.name} is locked. Unlock it first to take money out.`); source = goal.accountId; from = goal.name; }

      const [{ today } = { today: 0 }] = await tx.select({ today: sql<number>`COALESCE(SUM(${withdrawals.amount}), 0)::float8` }).from(withdrawals)
        .where(and(eq(withdrawals.userId, userId), gte(withdrawals.createdAt, startOfLagosDay()), inArray(withdrawals.status, ['processing', 'held', 'paid'])));
      const rules = await this.settings.get();
      const holdReason = Number(today) + input.amount > rules.dailyWithdrawalLimitKobo ? 'over_daily_limit'
        : rules.holdNewBank && Date.now() - bank.createdAt.getTime() < RULES.newBankHoldHours * 3_600_000 ? 'new_bank' : null;

      const reference = newReference('WD');
      const clearing = await this.ledger.systemAccount(tx, 'payout_clearing');
      const transactionId = await this.ledger.post(tx, { kind: 'withdrawal', reference, userId, idempotencyKey, description: `Withdrawal to ${bank.bankName}`, metadata: { from, bankLast4: bank.accountNumber.slice(-4) },
        entries: [{ accountId: source, amount: -input.amount }, { accountId: clearing, amount: input.amount }] });
      const [w] = await tx.insert(withdrawals).values({ userId, bankAccountId: bank.id, sourceAccountId: source, amount: input.amount, status: holdReason ? 'held' : 'processing', holdReason, reference, transactionId }).returning();
      await tx.insert(outbox).values({ topic: holdReason ? 'withdrawal.held' : 'withdrawal.send', payload: { withdrawalId: w!.id, reference } });
      return { w: w!, repeated: false };
    });
    return this.withdrawalView(row.w, row.repeated);
  }

  private withdrawalView(w: typeof withdrawals.$inferSelect, repeated = false) {
    const why = { over_daily_limit: 'This takes you over your daily limit, so our team will review it before it is sent.', new_bank: 'This bank account was added in the last 24 hours, so we are holding the transfer briefly for your safety.' } as Record<string, string>;
    return { id: w.id, reference: w.reference, amount: w.amount, status: w.status, holdReason: w.holdReason, message: w.holdReason ? why[w.holdReason] : null, createdAt: w.createdAt, repeated };
  }

  /** Finance releases a held withdrawal, or rejects it and returns the money. */
  async decideHeld(withdrawalId: string, decision: 'release' | 'reject', adminName: string) {
    return this.ledger.run(async (tx) => {
      const [w] = await tx.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
      if (!w) throw notFound('Withdrawal');
      if (w.status !== 'held') throw conflict('not_held', 'This withdrawal is no longer on hold.');
      if (decision === 'release') {
        await tx.update(withdrawals).set({ status: 'processing', decidedBy: adminName }).where(eq(withdrawals.id, w.id));
        await notify(tx, w.userId, 'wallet', `Your withdrawal of ${naira(w.amount)} was approved and is on its way.`, '/wallet/history');
        await tx.insert(outbox).values({ topic: 'withdrawal.send', payload: { withdrawalId: w.id, reference: w.reference } });
        return { status: 'processing' as const };
      }
      await this.returnFunds(tx, w, 'rejected', adminName);
      return { status: 'rejected' as const };
    });
  }

  /** The partner's verdict on a transfer we sent. Safe to receive more than once. */
  async settleWithdrawal(reference: string, outcome: 'paid' | 'failed') {
    return this.ledger.run(async (tx) => {
      const [w] = await tx.select().from(withdrawals).where(eq(withdrawals.reference, reference));
      if (!w) throw notFound('Withdrawal');
      if (w.status !== 'processing') return { status: w.status, changed: false };
      if (outcome === 'failed') { await this.returnFunds(tx, w, 'failed'); return { status: 'failed' as const, changed: true }; }
      const clearing = await this.ledger.systemAccount(tx, 'payout_clearing'); const float = await this.ledger.systemAccount(tx, 'partner_float');
      await this.ledger.post(tx, { kind: 'withdrawal_paid', reference: `${w.reference}-PAID`, userId: w.userId, description: 'Withdrawal paid out', entries: [{ accountId: clearing, amount: -w.amount }, { accountId: float, amount: w.amount }] });
      await tx.update(withdrawals).set({ status: 'paid', settledAt: new Date() }).where(eq(withdrawals.id, w.id));
      await notify(tx, w.userId, 'wallet', `Your withdrawal of ${naira(w.amount)} has reached your bank.`, '/wallet/history');
      await tx.insert(outbox).values({ topic: 'withdrawal.paid', payload: { withdrawalId: w.id } });
      return { status: 'paid' as const, changed: true };
    });
  }

  private async returnFunds(tx: Tx, w: typeof withdrawals.$inferSelect, status: 'failed' | 'rejected', decidedBy?: string) {
    const clearing = await this.ledger.systemAccount(tx, 'payout_clearing');
    await this.ledger.post(tx, { kind: 'withdrawal_reversed', reference: `${w.reference}-REV`, userId: w.userId, description: 'Withdrawal returned to your wallet', entries: [{ accountId: clearing, amount: -w.amount }, { accountId: w.sourceAccountId, amount: w.amount }] });
    await tx.update(withdrawals).set({ status, decidedBy, settledAt: new Date() }).where(eq(withdrawals.id, w.id));
    await notify(tx, w.userId, 'wallet', status === 'failed' ? `Your bank could not take the transfer, so ${naira(w.amount)} is back in your wallet.` : `Your withdrawal of ${naira(w.amount)} was not approved. The money is back in your wallet.`, '/wallet/history');
    await tx.insert(outbox).values({ topic: 'withdrawal.returned', payload: { withdrawalId: w.id, status } });
  }
}
