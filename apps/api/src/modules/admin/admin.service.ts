import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { RULES } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { maskEmail } from '../auth/auth.service.js';
import { notify } from '../../common/notify.js';
import { advice, bankAccounts, ledgerAccounts, ledgerEntries, ledgerTransactions, sessions, users, withdrawals } from '../../db/schema.js';

const contact = (email: string | null, phone?: string | null) => (email ? maskEmail(email) : phone?.replace(/^(\+234\d{3})\d{3}(\d{4})$/, '$1 ••• $2') ?? 'Unknown');
const REASONS: Record<string, string> = { over_daily_limit: 'Over daily limit', new_bank: 'Bank added in the last 24 hours' };

/** Read-only views of customer money for Finance and Support. Changes go through WalletService and the ledger. */
@Injectable()
export class AdminWalletService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  async summary() {
    const total = (where: ReturnType<typeof sql>) => this.db.execute(sql`SELECT COALESCE(SUM(a.balance), 0)::float8 AS n FROM ledger_accounts a LEFT JOIN savings_goals g ON g.account_id = a.id WHERE ${where}`).then((r) => Number((r.rows[0] as { n: number }).n));
    const [available, inGoals, lockedInGoals, inTransit] = await Promise.all([total(sql`a.kind = 'user_available'`), total(sql`a.kind = 'goal'`), total(sql`a.kind = 'goal' AND g.locked`), total(sql`a.kind = 'payout_clearing'`)]);
    const [held] = await this.db.select({ n: sql<number>`count(*)::int`, amount: sql<number>`COALESCE(SUM(${withdrawals.amount}), 0)::float8` }).from(withdrawals).where(eq(withdrawals.status, 'held'));
    return { totalHeld: available + inGoals, available, inGoals, lockedInGoals, inTransit, heldCount: held?.n ?? 0, heldAmount: Number(held?.amount ?? 0) };
  }

  async withdrawals(status: 'held' | 'processing' | 'all') {
    const rows = await this.db.select({ w: withdrawals, email: users.email, name: users.name, bank: bankAccounts.bankName, account: bankAccounts.accountNumber, bankAdded: bankAccounts.createdAt })
      .from(withdrawals).innerJoin(users, eq(users.id, withdrawals.userId)).innerJoin(bankAccounts, eq(bankAccounts.id, withdrawals.bankAccountId))
      .where(status === 'all' ? undefined : eq(withdrawals.status, status)).orderBy(withdrawals.createdAt).limit(200);
    return rows.map((r) => ({ id: r.w.id, reference: r.w.reference, userId: r.w.userId, user: r.name ?? contact(r.email), amount: r.w.amount, to: `${r.bank} •••• ${r.account.slice(-4)}`,
      bankIsNew: r.w.createdAt.getTime() - r.bankAdded.getTime() < RULES.newBankHoldHours * 3_600_000, reason: r.w.holdReason ? (REASONS[r.w.holdReason] ?? r.w.holdReason) : null, status: r.w.status, createdAt: r.w.createdAt }));
  }
  async withdrawal(id: string) { const [w] = await this.db.select().from(withdrawals).where(eq(withdrawals.id, id)); return w; }

  /** Newest ledger transactions. `customerChange` is what it did to the customer's own money (zero for bank-side steps). */
  async ledger(limit = 50) {
    const txns = await this.db.select({ t: ledgerTransactions, email: users.email, name: users.name }).from(ledgerTransactions).leftJoin(users, eq(users.id, ledgerTransactions.userId)).orderBy(desc(ledgerTransactions.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
    if (!txns.length) return [];
    const moves = await this.db.select({ txnId: ledgerEntries.transactionId, amount: ledgerEntries.amount, owner: ledgerAccounts.userId }).from(ledgerEntries).innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId)).where(inArray(ledgerEntries.transactionId, txns.map((x) => x.t.id)));
    return txns.map(({ t, email, name }) => {
      const mine = moves.filter((m) => m.txnId === t.id);
      return { reference: t.reference, kind: t.kind, description: t.description, user: t.userId ? (name ?? contact(email)) : 'Platform', at: t.createdAt,
        amount: Math.max(0, ...mine.map((m) => m.amount)), customerChange: mine.filter((m) => m.owner).reduce((n, m) => n + m.amount, 0) };
    });
  }

  /** Badges for the console sidebar. */
  async counts() {
    const [w] = await this.db.select({ n: sql<number>`count(*)::int` }).from(withdrawals).where(eq(withdrawals.status, 'held'));
    const [a] = await this.db.select({ n: sql<number>`count(*)::int` }).from(advice).where(and(inArray(advice.status, ['in_review', 'rereview']), isNull(advice.reviewedAt)));
    const r = await this.db.execute(sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM reports WHERE resolved_at IS NULL GROUP BY target_type, target_id) g`);
    return { heldWithdrawals: w?.n ?? 0, adviceWaiting: a?.n ?? 0, openReports: Number((r.rows[0] as { n: number }).n) };
  }
}

const maskAccount = (n: string) => `•••• ${n.slice(-4)}`;

/** Customer accounts for Support, and the numbers on the Overview page. */
@Injectable()
export class AdminUsersService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  async list(q: { search?: string; filter?: string }) {
    const term = q.search?.trim().replace(/[%_]/g, '');
    const where = sql.join([sql`TRUE`,
      ...(term ? [sql`(u.name ILIKE ${'%' + term + '%'} OR u.email ILIKE ${'%' + term + '%'} OR u.handle ILIKE ${'%' + term + '%'} OR u.id::text = ${term})`] : []),
      ...(q.filter === 'kyc_failed' ? [sql`u.kyc_status = 'failed'`] : q.filter === 'suspended' ? [sql`u.status = 'suspended'`] : q.filter === 'frozen' ? [sql`u.wallet_frozen`] : q.filter === 'sellers' ? [sql`EXISTS (SELECT 1 FROM plans p WHERE p.user_id = u.id AND p.mode = 'sell' AND p.removed_at IS NULL)`] : []),
    ], sql` AND `);
    const rows = await this.db.execute(sql`SELECT u.id, u.name, u.email, u.phone, u.handle, u.created_at, u.kyc_status, u.kyc_method, u.status, u.wallet_frozen,
        (SELECT COALESCE(SUM(a.balance), 0)::float8 FROM ledger_accounts a WHERE a.user_id = u.id) AS wallet,
        (SELECT count(*)::int FROM plan_purchases pp WHERE pp.seller_id = u.id AND pp.price > 0 AND pp.refunded_at IS NULL) AS plans_sold
      FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT 200`);
    const counts = await this.db.execute(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE kyc_status = 'verified')::int AS verified, count(*) FILTER (WHERE kyc_status = 'failed')::int AS kyc_failed, count(*) FILTER (WHERE status = 'suspended')::int AS suspended, count(*) FILTER (WHERE wallet_frozen)::int AS frozen FROM users`);
    type R = { id: string; name: string | null; email: string | null; phone: string | null; handle: string | null; created_at: Date; kyc_status: string; kyc_method: string | null; status: string; wallet_frozen: boolean; wallet: number; plans_sold: number };
    return { counts: counts.rows[0], users: (rows.rows as R[]).map((u) => ({ id: u.id, name: u.name ?? 'No name yet', contact: contact(u.email, u.phone), handle: u.handle, joined: u.created_at, kyc: u.kyc_status, kycMethod: u.kyc_method, status: u.status, walletFrozen: u.wallet_frozen, wallet: Number(u.wallet), plansSold: u.plans_sold })) };
  }

  async detail(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id));
    if (!u) return null;
    const stats = await this.db.execute(sql`SELECT
      (SELECT count(*)::int FROM tips WHERE user_id = ${id} AND status = 'published') AS tips,
      (SELECT count(*)::int FROM advice WHERE user_id = ${id}) AS advice,
      (SELECT count(*)::int FROM advice WHERE user_id = ${id} AND status = 'verified') AS verified,
      (SELECT count(*)::int FROM trips WHERE user_id = ${id}) AS trips,
      (SELECT COALESCE(SUM(balance), 0)::float8 FROM ledger_accounts WHERE user_id = ${id} AND kind = 'user_available') AS available,
      (SELECT COALESCE(SUM(balance), 0)::float8 FROM ledger_accounts WHERE user_id = ${id} AND kind = 'goal') AS in_goals,
      (SELECT max(created_at) FROM sessions WHERE user_id = ${id}) AS last_seen`);
    const banks = await this.db.select().from(bankAccounts).where(eq(bankAccounts.userId, id));
    const s = stats.rows[0] as { tips: number; advice: number; verified: number; trips: number; available: number; in_goals: number; last_seen: Date | null };
    return { id: u.id, name: u.name ?? 'No name yet', contact: contact(u.email, u.phone), handle: u.handle, city: u.city, joined: u.createdAt, status: u.status, walletFrozen: u.walletFrozen,
      kyc: { status: u.kycStatus, method: u.kycMethod, attempts: u.kycAttempts, legalName: u.legalName }, hasPin: !!u.pinHash, pinLocked: !!u.pinLockedUntil && u.pinLockedUntil > new Date(),
      wallet: { available: Number(s.available), inGoals: Number(s.in_goals) }, tips: s.tips, advice: s.advice, verifiedAdvice: s.verified, trips: s.trips, lastSeen: s.last_seen,
      banks: banks.filter((b) => !b.removedAt).map((b) => ({ bank: b.bankName, account: maskAccount(b.accountNumber), name: b.accountName, isDefault: b.isDefault })) };
  }

  /** Support actions. Each returns a short description for the audit log. */
  async act(id: string, action: 'suspend' | 'reinstate' | 'freeze' | 'unfreeze' | 'reset_kyc' | 'reset_pin') {
    const [u] = await this.db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, id));
    if (!u) return null;
    const who = u.name ?? contact(u.email);
    if (action === 'suspend') { await this.db.update(users).set({ status: 'suspended', walletFrozen: true }).where(eq(users.id, id)); await this.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt))); return { who, did: 'Suspended account and froze wallet' }; }
    if (action === 'reinstate') { await this.db.update(users).set({ status: 'active', walletFrozen: false }).where(eq(users.id, id)); return { who, did: 'Reinstated account' }; }
    if (action === 'freeze' || action === 'unfreeze') { await this.db.update(users).set({ walletFrozen: action === 'freeze' }).where(eq(users.id, id)); return { who, did: action === 'freeze' ? 'Froze wallet' : 'Unfroze wallet' }; }
    if (action === 'reset_kyc') { await this.db.update(users).set({ kycAttempts: 0, kycStatus: sql`CASE WHEN ${users.kycStatus} = 'failed' THEN 'none'::kyc_status ELSE ${users.kycStatus} END` }).where(eq(users.id, id)); return { who, did: 'Reset ID check attempts' }; }
    await this.db.update(users).set({ pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(users.id, id));
    await notify(this.db, id, 'wallet', 'Support reset your wallet PIN. Create a new one in Wallet settings before your next withdrawal.', '/wallet/setup/pin');
    return { who, did: 'Reset wallet PIN' };
  }

  async overview() {
    const one = async <T>(q: ReturnType<typeof sql>) => (await this.db.execute(q)).rows[0] as T;
    const u = await one<{ total: number; recent: number; before: number; verified: number; kyc_failed: number }>(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at > now() - interval '28 days')::int AS recent, count(*) FILTER (WHERE created_at <= now() - interval '28 days' AND created_at > now() - interval '56 days')::int AS before, count(*) FILTER (WHERE kyc_status = 'verified')::int AS verified, count(*) FILTER (WHERE kyc_status = 'failed')::int AS kyc_failed FROM users`);
    const money = await one<{ held: number; fees: number; shop: number; owed: number }>(sql`SELECT COALESCE(SUM(balance) FILTER (WHERE user_id IS NOT NULL), 0)::float8 AS held, COALESCE(SUM(balance) FILTER (WHERE kind = 'platform_fees'), 0)::float8 AS fees, COALESCE(SUM(balance) FILTER (WHERE kind = 'shop_revenue'), 0)::float8 AS shop, COALESCE(SUM(balance) FILTER (WHERE kind = 'creator_payable'), 0)::float8 AS owed FROM ledger_accounts`);
    const todo = await one<{ advice: number; reports: number; held: number; held_amount: number; orders: number }>(sql`SELECT
      (SELECT count(*)::int FROM advice WHERE status IN ('in_review', 'rereview')) AS advice,
      (SELECT count(*)::int FROM (SELECT 1 FROM reports WHERE resolved_at IS NULL GROUP BY target_type, target_id) g) AS reports,
      (SELECT count(*)::int FROM withdrawals WHERE status = 'held') AS held, (SELECT COALESCE(SUM(amount), 0)::float8 FROM withdrawals WHERE status = 'held') AS held_amount,
      (SELECT count(*)::int FROM orders WHERE status = 'placed') AS orders`);
    const weeks = await this.db.execute(sql`SELECT to_char(w, 'DD Mon') AS week, (SELECT count(*)::int FROM users WHERE created_at >= w AND created_at < w + interval '7 days') AS value FROM generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '7 days') w ORDER BY w`);
    const flow = await this.db.execute(sql`SELECT t.kind, COALESCE(SUM(e.amount) FILTER (WHERE e.amount > 0), 0)::float8 AS amount FROM ledger_transactions t JOIN ledger_entries e ON e.transaction_id = t.id WHERE t.created_at > now() - interval '28 days' AND t.kind IN ('deposit', 'goal_in', 'withdrawal', 'purchase', 'plan_sale') GROUP BY t.kind`);
    const recent = (await this.db.execute(sql`SELECT l.created_at, a.name, l.action, l.item FROM audit_log l JOIN admins a ON a.id = l.admin_id ORDER BY l.created_at DESC LIMIT 6`)).rows as { created_at: Date; name: string; action: string; item: string }[];
    return { users: { total: u.total, last28Days: u.recent, previous28Days: u.before, verifiedWallets: u.verified }, money: { heldForCustomers: Number(money.held), planFees: Number(money.fees), shopSales: Number(money.shop), owedToCreators: Number(money.owed) },
      attention: { adviceWaiting: todo.advice, openReports: todo.reports, heldWithdrawals: todo.held, heldAmount: Number(todo.held_amount), idChecksFailed: u.kyc_failed, ordersToPack: todo.orders },
      signups: weeks.rows as { week: string; value: number }[], flow: Object.fromEntries((flow.rows as { kind: string; amount: number }[]).map((r) => [r.kind, Number(r.amount)])),
      activity: recent.map((r) => ({ at: r.created_at, admin: r.name, action: r.action, item: r.item })) };
  }
}
