import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { AppError } from '../../common/errors.js';
import { Database, type Tx } from '../../db/db.module.js';
import { ledgerAccounts, ledgerEntries, ledgerTransactions } from '../../db/schema.js';

type TxnKind = (typeof ledgerTransactions.$inferInsert)['kind'];
type SystemAccount = 'partner_float' | 'payout_clearing' | 'platform_fees' | 'card_clearing' | 'creator_payable' | 'shop_revenue';
export interface Posting {
  kind: TxnKind; reference: string; description: string; userId?: string; idempotencyKey?: string;
  metadata?: Record<string, unknown>; entries: { accountId: string; amount: number }[];
}

/** Postgres error code, whether or not the driver error was wrapped. */
export const pgCode = (e: unknown): { code?: string; constraint?: string } => {
  for (let cur = e as { code?: string; constraint?: string; cause?: unknown } | undefined, i = 0; cur && i < 4; cur = cur.cause as typeof cur, i++) if (typeof cur.code === 'string' && /^[0-9A-Z]{5}$/.test(cur.code)) return cur;
  return {};
};
export const newReference = (prefix: string) => `EC-${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;

/**
 * The double-entry ledger. Every movement of money is one transaction whose signed
 * entries add up to zero, written together with the running balances.
 *
 * Safety comes from the database, not from this class:
 *  - SERIALIZABLE isolation, retried on conflict, so two requests can never both spend the same naira;
 *  - a CHECK constraint that stops customer accounts going below zero;
 *  - a commit-time trigger that rejects a transaction that does not balance;
 *  - entries are append-only.
 */
@Injectable()
export class Ledger {
  constructor(private readonly database: Database) {}

  /** Runs `work` in one SERIALIZABLE transaction and retries it when Postgres reports a conflict. */
  async run<T>(work: (tx: Tx) => Promise<T>, attempts = 6): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.database.db.transaction(work, { isolationLevel: 'serializable' });
      } catch (e) {
        const { code, constraint } = pgCode(e);
        // 40001 serialization failure, 40P01 deadlock, 23505 a racing request with the same idempotency key
        const retry = code === '40001' || code === '40P01' || (code === '23505' && constraint?.includes('idempotency'));
        if (retry && attempt < attempts) { await new Promise((r) => setTimeout(r, 15 * attempt + Math.random() * 25)); continue; }
        if (code === '23514' && constraint === 'ledger_accounts_no_overdraft') throw new AppError(400, 'insufficient_funds', 'There is not enough money there for this.');
        if (retry) throw new AppError(503, 'busy', 'We could not complete that just now. Please try again.');
        throw e;
      }
    }
  }

  /** Writes one balanced transaction inside an open database transaction. */
  async post(tx: Tx, p: Posting): Promise<string> {
    const total = p.entries.reduce((n, e) => n + e.amount, 0);
    if (total !== 0) throw new Error(`Ledger posting ${p.reference} does not balance (sum ${total})`);
    if (p.entries.some((e) => !Number.isSafeInteger(e.amount) || e.amount === 0)) throw new Error(`Ledger posting ${p.reference} has an invalid amount`);

    const [txn] = await tx.insert(ledgerTransactions).values({ kind: p.kind, reference: p.reference, description: p.description, userId: p.userId, idempotencyKey: p.idempotencyKey, metadata: p.metadata ?? {} }).returning({ id: ledgerTransactions.id });
    await tx.insert(ledgerEntries).values(p.entries.map((e) => ({ transactionId: txn!.id, accountId: e.accountId, amount: e.amount })));
    // Fixed order so two transactions touching the same accounts cannot deadlock.
    for (const e of [...p.entries].sort((a, b) => a.accountId.localeCompare(b.accountId))) {
      await tx.update(ledgerAccounts).set({ balance: sql`${ledgerAccounts.balance} + ${e.amount}` }).where(eq(ledgerAccounts.id, e.accountId));
    }
    return txn!.id;
  }

  /** The earlier transaction made with this key, if the request is a repeat. */
  async findByKey(tx: Tx, userId: string, key: string | undefined) {
    if (!key) return undefined;
    const [t] = await tx.select().from(ledgerTransactions).where(and(eq(ledgerTransactions.idempotencyKey, key), eq(ledgerTransactions.userId, userId)));
    return t;
  }

  async systemAccount(tx: Tx, kind: SystemAccount): Promise<string> {
    const find = () => tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(and(eq(ledgerAccounts.kind, kind), isNull(ledgerAccounts.userId)));
    let [a] = await find();
    // Accounts added after the first release are created the first time they are used.
    if (!a) { await tx.insert(ledgerAccounts).values({ kind }).onConflictDoNothing(); [a] = await find(); }
    if (!a) throw new Error(`System ledger account ${kind} is missing.`);
    return a.id;
  }

  /** The customer's available-balance account, created the first time it is needed. */
  async availableAccount(tx: Tx, userId: string): Promise<string> {
    await tx.insert(ledgerAccounts).values({ kind: 'user_available', userId }).onConflictDoNothing();
    const [a] = await tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(and(eq(ledgerAccounts.kind, 'user_available'), eq(ledgerAccounts.userId, userId)));
    return a!.id;
  }

  /** Proof for the daily reconciliation job: all entries sum to zero and every running balance matches its entries. */
  async audit() {
    const db = this.database.db;
    const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)::float8` }).from(ledgerEntries);
    const drift = await db.execute(sql`SELECT a.id FROM ledger_accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id GROUP BY a.id, a.balance HAVING a.balance <> COALESCE(SUM(e.amount), 0)`);
    return { entriesSum: Number(total), accountsOutOfStep: drift.rows.length };
  }
}
