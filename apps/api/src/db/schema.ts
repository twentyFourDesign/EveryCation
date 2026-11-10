import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
/** Money is whole kobo. */
const kobo = () => bigint({ mode: 'number' });

export const kycStatus = pgEnum('kyc_status', ['none', 'verified', 'failed']);
export const userStatus = pgEnum('user_status', ['active', 'suspended']);

export const users = pgTable('users', {
  id: id(),
  phone: text().unique(),
  email: text().unique(),
  name: text(),
  handle: text().unique(),
  status: userStatus().notNull().default('active'),
  kycStatus: kycStatus().notNull().default('none'),
  kycMethod: text(),
  kycAttempts: integer().notNull().default(0),
  legalName: text(),
  pinHash: text(),
  pinFailedAttempts: integer().notNull().default(0),
  pinLockedUntil: timestamp({ withTimezone: true }),
  walletFrozen: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const otpCodes = pgTable('otp_codes', {
  id: id(),
  destination: text().notNull(),
  codeHash: text().notNull(),
  attempts: integer().notNull().default(0),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('otp_destination_idx').on(t.destination, t.createdAt)]);

/** One row per refresh token. Tokens rotate; reuse of an old one revokes the whole family. */
export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  familyId: uuid().notNull(),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  rotatedAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  device: text(),
  createdAt: createdAt(),
}, (t) => [index('sessions_family_idx').on(t.familyId)]);

export const bankAccounts = pgTable('bank_accounts', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  bankName: text().notNull(),
  accountNumber: text().notNull(),
  accountName: text().notNull(),
  isDefault: boolean().notNull().default(false),
  removedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('bank_user_number_idx').on(t.userId, t.bankName, t.accountNumber)]);

export const accountKind = pgEnum('ledger_account_kind', ['user_available', 'goal', 'partner_float', 'payout_clearing', 'platform_fees', 'card_clearing']);

/**
 * Ledger accounts. `balance` is a running total kept in step with ledger_entries
 * inside the same transaction. Customer accounts can never go below zero: the
 * database refuses it, whatever the application code does.
 */
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: id(),
  kind: accountKind().notNull(),
  userId: uuid().references(() => users.id),
  balance: kobo().notNull().default(0),
  allowNegative: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  check('ledger_accounts_no_overdraft', sql`${t.allowNegative} OR ${t.balance} >= 0`),
  uniqueIndex('ledger_user_available_idx').on(t.userId).where(sql`${t.kind} = 'user_available'`),
  uniqueIndex('ledger_system_kind_idx').on(t.kind).where(sql`${t.userId} IS NULL`),
]);

export const txnKind = pgEnum('ledger_txn_kind', ['deposit', 'goal_in', 'goal_out', 'withdrawal', 'withdrawal_paid', 'withdrawal_reversed', 'purchase', 'plan_sale', 'platform_fee', 'payout', 'refund']);

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: id(),
  kind: txnKind().notNull(),
  reference: text().notNull().unique(),
  idempotencyKey: text().unique(),
  userId: uuid().references(() => users.id),
  description: text().notNull(),
  metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index('ledger_txn_user_idx').on(t.userId, t.createdAt)]);

/** Signed amounts. The entries of one transaction always add up to zero. */
export const ledgerEntries = pgTable('ledger_entries', {
  id: id(),
  transactionId: uuid().notNull().references(() => ledgerTransactions.id),
  accountId: uuid().notNull().references(() => ledgerAccounts.id),
  amount: kobo().notNull(),
  createdAt: createdAt(),
}, (t) => [index('ledger_entries_account_idx').on(t.accountId, t.createdAt), index('ledger_entries_txn_idx').on(t.transactionId), check('ledger_entries_nonzero', sql`${t.amount} <> 0`)]);

export const goalKind = pgEnum('goal_kind', ['trip', 'shopping', 'package']);
export const saveFrequency = pgEnum('save_frequency', ['daily', 'weekly', 'monthly']);

export const savingsGoals = pgTable('savings_goals', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  accountId: uuid().notNull().references(() => ledgerAccounts.id),
  name: text().notNull(),
  kind: goalKind().notNull(),
  target: kobo().notNull(),
  targetDate: date(),
  locked: boolean().notNull().default(false),
  autoSaveAmount: kobo(),
  autoSaveFrequency: saveFrequency(),
  closedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('goals_user_idx').on(t.userId), check('goals_target_positive', sql`${t.target} > 0`)]);

export const withdrawalStatus = pgEnum('withdrawal_status', ['processing', 'held', 'paid', 'failed', 'rejected']);

export const withdrawals = pgTable('withdrawals', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  bankAccountId: uuid().notNull().references(() => bankAccounts.id),
  sourceAccountId: uuid().notNull().references(() => ledgerAccounts.id),
  amount: kobo().notNull(),
  status: withdrawalStatus().notNull(),
  holdReason: text(),
  reference: text().notNull().unique(),
  transactionId: uuid().notNull().references(() => ledgerTransactions.id),
  decidedBy: text(),
  createdAt: createdAt(),
  settledAt: timestamp({ withTimezone: true }),
}, (t) => [index('withdrawals_user_idx').on(t.userId, t.createdAt), index('withdrawals_status_idx').on(t.status)]);

/** Every partner webhook we accept, so a repeat delivery is recognised and ignored. */
export const webhookEvents = pgTable('webhook_events', {
  id: id(),
  provider: text().notNull(),
  eventId: text().notNull(),
  payload: jsonb().notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('webhook_provider_event_idx').on(t.provider, t.eventId)]);

/** Follow-up work written in the same transaction as the money movement; a worker sends it on. */
export const outbox = pgTable('outbox', {
  id: id(),
  topic: text().notNull(),
  payload: jsonb().notNull(),
  processedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('outbox_pending_idx').on(t.createdAt).where(sql`${t.processedAt} IS NULL`)]);
