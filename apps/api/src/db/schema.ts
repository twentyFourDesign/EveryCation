import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, doublePrecision } from 'drizzle-orm/pg-core';

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
  city: text(),
  bio: text(),
  passportCountry: text().notNull().default('NG'),
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

export const accountKind = pgEnum('ledger_account_kind', ['user_available', 'goal', 'partner_float', 'payout_clearing', 'platform_fees', 'card_clearing', 'creator_payable', 'shop_revenue']);

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

// ───────────── Staff ─────────────

export const adminRole = pgEnum('admin_role', ['super_admin', 'moderator', 'finance', 'shop_ops', 'support']);

export const admins = pgTable('admins', {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  role: adminRole().notNull(),
  passwordHash: text().notNull(),
  /** Base32 secret for the authenticator app. Every staff account has two-step sign-in. */
  totpSecret: text().notNull(),
  active: boolean().notNull().default(true),
  lastActiveAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: id(),
  adminId: uuid().notNull().references(() => admins.id),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

/** Every staff action that changes something. Append-only by convention; never updated. */
export const auditLog = pgTable('audit_log', {
  id: id(),
  adminId: uuid().notNull().references(() => admins.id),
  action: text().notNull(),
  item: text().notNull(),
  ip: text(),
  userAgent: text(),
  createdAt: createdAt(),
}, (t) => [index('audit_created_idx').on(t.createdAt)]);

// ───────────── Community: tips and comments ─────────────

export const contentStatus = pgEnum('content_status', ['published', 'removed']);
export const tipFormat = pgEnum('tip_format', ['write', 'video', 'voice']);

export const tips = pgTable('tips', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  title: text().notNull(),
  place: text().notNull(),
  countryCode: text(),
  category: text().notNull(),
  format: tipFormat().notNull().default('write'),
  body: text().notNull().default(''),
  goodToKnow: jsonb().$type<string[]>().notNull().default([]),
  /** Media storage is not connected yet; this names a bundled photo, or is empty. */
  imageKey: text(),
  mediaId: uuid(),
  visited: text(),
  status: contentStatus().notNull().default('published'),
  likeCount: integer().notNull().default(0),
  commentCount: integer().notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index('tips_feed_idx').on(t.status, t.createdAt), index('tips_user_idx').on(t.userId)]);

export const tipLikes = pgTable('tip_likes', {
  tipId: uuid().notNull().references(() => tips.id),
  userId: uuid().notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('tip_likes_once_idx').on(t.tipId, t.userId)]);

export const comments = pgTable('comments', {
  id: id(),
  tipId: uuid().notNull().references(() => tips.id),
  userId: uuid().notNull().references(() => users.id),
  body: text().notNull(),
  status: contentStatus().notNull().default('published'),
  createdAt: createdAt(),
}, (t) => [index('comments_tip_idx').on(t.tipId, t.createdAt)]);

// ───────────── Travel advice ─────────────

/** `verified` only ever follows an admin approval (locked rule). `rereview` is verified advice sent back by reports. */
export const adviceStatus = pgEnum('advice_status', ['in_review', 'changes_requested', 'verified', 'rejected', 'rereview']);

export const advice = pgTable('advice', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  countryCode: text().notNull(),
  city: text().notNull(),
  topic: text().notNull(),
  body: text().notNull(),
  visited: text(),
  showPassport: boolean().notNull().default(true),
  status: adviceStatus().notNull().default('in_review'),
  reviewNote: text(),
  reviewedBy: uuid().references(() => admins.id),
  reviewedAt: timestamp({ withTimezone: true }),
  helpfulCount: integer().notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index('advice_country_idx').on(t.countryCode, t.status), index('advice_queue_idx').on(t.status, t.createdAt)]);

export const adviceHelpful = pgTable('advice_helpful', {
  adviceId: uuid().notNull().references(() => advice.id),
  userId: uuid().notNull().references(() => users.id),
}, (t) => [uniqueIndex('advice_helpful_once_idx').on(t.adviceId, t.userId)]);

export const reportTarget = pgEnum('report_target', ['tip', 'comment', 'advice']);

/** One report per person per item. */
export const reports = pgTable('reports', {
  id: id(),
  targetType: reportTarget().notNull(),
  targetId: uuid().notNull(),
  reporterId: uuid().notNull().references(() => users.id),
  reason: text().notNull(),
  resolvedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('reports_once_idx').on(t.targetType, t.targetId, t.reporterId), index('reports_target_idx').on(t.targetType, t.targetId)]);

// ───────────── Notifications ─────────────

/** In-app notifications. Push delivery reads the same rows once a push provider is connected. */
export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  type: text().notNull(),
  text: text().notNull(),
  /** App route to open, e.g. /advice/GH. */
  href: text(),
  /** Set when the notification came from a staff broadcast, so opens can be counted. */
  broadcastId: uuid().references(() => broadcasts.id),
  readAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)]);

// ───────────── Trips ─────────────

export const trips = pgTable('trips', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  title: text().notNull(),
  place: text().notNull(),
  countryCode: text().notNull(),
  startDate: date().notNull(),
  endDate: date().notNull(),
  travellers: integer().notNull().default(1),
  imageKey: text(),
  /** Where to pin the trip on a map: a known place when the name matches one, otherwise the middle of the country. */
  lat: doublePrecision(),
  lng: doublePrecision(),
  createdAt: createdAt(),
}, (t) => [index('trips_user_idx').on(t.userId, t.startDate), check('trips_dates_in_order', sql`${t.endDate} >= ${t.startDate}`)]);

export const itineraryItems = pgTable('itinerary_items', {
  id: id(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  day: date().notNull(),
  time: text().notNull(),
  title: text().notNull(),
  note: text().notNull().default(''),
  remind: text(),
  createdAt: createdAt(),
}, (t) => [index('itinerary_trip_idx').on(t.tripId, t.day, t.time)]);

export const bucketState = pgEnum('bucket_state', ['dream', 'done']);
export const bucketItems = pgTable('bucket_items', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  title: text().notNull(),
  state: bucketState().notNull().default('dream'),
  /** Where it came from: a tip or a place, so the same thing is not added twice. */
  source: text(),
  imageKey: text(),
  createdAt: createdAt(),
}, (t) => [index('bucket_user_idx').on(t.userId), uniqueIndex('bucket_source_once_idx').on(t.userId, t.source)]);

// ───────────── Media ─────────────

/** An uploaded photo, video or voice note. Files live in object storage; this row is the record of who uploaded what. */
export const media = pgTable('media', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  kind: text().notNull(),
  contentType: text().notNull(),
  size: integer().notNull(),
  /** Storage key, e.g. tips/2026/11/<uuid>.jpg. The public URL is built from it. */
  key: text().notNull(),
  createdAt: createdAt(),
});

// ───────────── Places and follows ─────────────

export const places = pgTable('places', {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  kind: text().notNull(),
  countryCode: text().notNull(),
  summary: text().notNull(),
  bestTime: text(),
  currency: text(),
  imageKey: text(),
  imageUrl: text(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  published: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const follows = pgTable('follows', {
  followerId: uuid().notNull().references(() => users.id),
  followeeId: uuid().notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('follows_once_idx').on(t.followerId, t.followeeId), index('follows_followee_idx').on(t.followeeId), check('follows_not_self', sql`${t.followerId} <> ${t.followeeId}`)]);

// ───────────── Trip plans marketplace ─────────────

export const planMode = pgEnum('plan_mode', ['private', 'free', 'sell']);

/** A trip offered to other travellers. One listing per trip. */
export const plans = pgTable('plans', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  tripId: uuid().notNull().references(() => trips.id).unique(),
  mode: planMode().notNull().default('private'),
  price: kobo().notNull().default(0),
  summary: text().notNull().default(''),
  removedAt: timestamp({ withTimezone: true }),
  /** Why staff removed it, e.g. "Spam: sells a visa service". */
  removedReason: text(),
  createdAt: createdAt(),
}, (t) => [index('plans_user_idx').on(t.userId), check('plans_price_not_negative', sql`${t.price} >= 0`)]);

export const planPurchases = pgTable('plan_purchases', {
  id: id(),
  planId: uuid().notNull().references(() => plans.id),
  buyerId: uuid().notNull().references(() => users.id),
  sellerId: uuid().notNull().references(() => users.id),
  price: kobo().notNull(),
  fee: kobo().notNull(),
  sellerAmount: kobo().notNull(),
  transactionId: uuid().references(() => ledgerTransactions.id),
  /** Set when Finance pays the seller. Null means the seller's share is still waiting. */
  payoutReference: text(),
  paidOutAt: timestamp({ withTimezone: true }),
  /** Set when the plan was removed and the buyer got their money back. */
  refundedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('plan_purchase_once_idx').on(t.planId, t.buyerId), index('plan_purchase_seller_idx').on(t.sellerId, t.paidOutAt)]);

// ───────────── Shop ─────────────

export const products = pgTable('products', {
  id: id(),
  name: text().notNull(),
  brand: text(),
  category: text().notNull(),
  price: kobo().notNull(),
  /** Units in stock. Null means a digital item (an eSIM) that never runs out. */
  stock: integer(),
  imageKey: text(),
  /** Address of an uploaded photo. Takes priority over the bundled sample photo. */
  imageUrl: text(),
  variant: text(),
  description: text().notNull().default(''),
  pickedNote: text(),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('products_category_idx').on(t.category), check('products_stock_not_negative', sql`${t.stock} IS NULL OR ${t.stock} >= 0`), check('products_price_positive', sql`${t.price} > 0`)]);

export const orderStatus = pgEnum('order_status', ['placed', 'packed', 'shipped', 'delivered', 'cancelled']);

export const orders = pgTable('orders', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  reference: text().notNull().unique(),
  status: orderStatus().notNull().default('placed'),
  subtotal: kobo().notNull(),
  deliveryFee: kobo().notNull(),
  total: kobo().notNull(),
  paidFromGoal: kobo().notNull().default(0),
  goalName: text(),
  delivery: text().notNull(),
  address: text().notNull(),
  phone: text().notNull(),
  transactionId: uuid().references(() => ledgerTransactions.id),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('orders_user_idx').on(t.userId, t.createdAt), index('orders_status_idx').on(t.status)]);

export const orderItems = pgTable('order_items', {
  id: id(),
  orderId: uuid().notNull().references(() => orders.id),
  productId: uuid().notNull().references(() => products.id),
  name: text().notNull(),
  imageKey: text(),
  price: kobo().notNull(),
  qty: integer().notNull(),
}, (t) => [index('order_items_order_idx').on(t.orderId), check('order_items_qty_positive', sql`${t.qty} > 0`)]);

// ───────────── Staff: settings and broadcasts ─────────────

/** Rules staff changed from the console. A missing key means the built-in default applies. */
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => admins.id),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** A message staff sent to a group of travellers. Each traveller gets a row in notifications that points back here. */
export const broadcasts = pgTable('broadcasts', {
  id: id(),
  adminId: uuid().notNull().references(() => admins.id),
  title: text().notNull(),
  message: text().notNull(),
  audience: text().notNull(),
  href: text(),
  recipients: integer().notNull().default(0),
  createdAt: createdAt(),
});
