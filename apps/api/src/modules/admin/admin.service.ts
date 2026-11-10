import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { RULES } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { advice, bankAccounts, ledgerAccounts, ledgerEntries, ledgerTransactions, users, withdrawals } from '../../db/schema.js';

const maskPhone = (p: string | null) => p?.replace(/^(\+234\d{3})\d{3}(\d{4})$/, '$1 ••• $2') ?? 'Unknown';
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
    const rows = await this.db.select({ w: withdrawals, phone: users.phone, name: users.name, bank: bankAccounts.bankName, account: bankAccounts.accountNumber, bankAdded: bankAccounts.createdAt })
      .from(withdrawals).innerJoin(users, eq(users.id, withdrawals.userId)).innerJoin(bankAccounts, eq(bankAccounts.id, withdrawals.bankAccountId))
      .where(status === 'all' ? undefined : eq(withdrawals.status, status)).orderBy(withdrawals.createdAt).limit(200);
    return rows.map((r) => ({ id: r.w.id, reference: r.w.reference, userId: r.w.userId, user: r.name ?? maskPhone(r.phone), amount: r.w.amount, to: `${r.bank} •••• ${r.account.slice(-4)}`,
      bankIsNew: r.w.createdAt.getTime() - r.bankAdded.getTime() < RULES.newBankHoldHours * 3_600_000, reason: r.w.holdReason ? (REASONS[r.w.holdReason] ?? r.w.holdReason) : null, status: r.w.status, createdAt: r.w.createdAt }));
  }
  async withdrawal(id: string) { const [w] = await this.db.select().from(withdrawals).where(eq(withdrawals.id, id)); return w; }

  /** Newest ledger transactions. `customerChange` is what it did to the customer's own money (zero for bank-side steps). */
  async ledger(limit = 50) {
    const txns = await this.db.select({ t: ledgerTransactions, phone: users.phone, name: users.name }).from(ledgerTransactions).leftJoin(users, eq(users.id, ledgerTransactions.userId)).orderBy(desc(ledgerTransactions.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
    if (!txns.length) return [];
    const moves = await this.db.select({ txnId: ledgerEntries.transactionId, amount: ledgerEntries.amount, owner: ledgerAccounts.userId }).from(ledgerEntries).innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId)).where(inArray(ledgerEntries.transactionId, txns.map((x) => x.t.id)));
    return txns.map(({ t, phone, name }) => {
      const mine = moves.filter((m) => m.txnId === t.id);
      return { reference: t.reference, kind: t.kind, description: t.description, user: t.userId ? (name ?? maskPhone(phone)) : 'Platform', at: t.createdAt,
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
