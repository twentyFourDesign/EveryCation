import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { RULES } from '../../config.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { Database } from '../../db/db.module.js';
import { itineraryItems, planPurchases, plans, trips, users } from '../../db/schema.js';
import { author } from '../community/tips.service.js';
import { Ledger, newReference } from '../wallet/ledger.service.js';
import { WalletService } from '../wallet/wallet.service.js';

const naira = (k: number) => `₦${(k / 100).toLocaleString('en-NG')}`;
/** BR-02: a paid plan opens for sale at 06:00 Lagos time the day after the seller's trip ends. */
export const saleOpensAt = (tripEnd: string) => new Date(Date.parse(`${tripEnd}T06:00:00+01:00`) + 86_400_000);
export const split = (price: number) => { const fee = Math.round(price * RULES.planFeeRate); return { fee, sellerAmount: price - fee }; };
type Row = { p: typeof plans.$inferSelect; t: typeof trips.$inferSelect; u: typeof users.$inferSelect };

@Injectable()
export class PlansService {
  constructor(private readonly database: Database, private readonly ledger: Ledger, private readonly wallet: WalletService) {}
  private get db() { return this.database.db; }
  private base() { return this.db.select({ p: plans, t: trips, u: users }).from(plans).innerJoin(trips, eq(trips.id, plans.tripId)).innerJoin(users, eq(users.id, plans.userId)); }

  private status(p: Row['p'], t: Row['t']) {
    if (p.removedAt) return 'removed' as const;
    if (p.mode !== 'sell') return p.mode;
    return saleOpensAt(t.endDate) <= new Date() ? 'on_sale' as const : 'scheduled' as const;
  }
  private async view(rows: Row[], viewerId?: string) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.p.id);
    const stops = await this.db.select({ tripId: itineraryItems.tripId, n: sql<number>`count(*)::int` }).from(itineraryItems).where(inArray(itineraryItems.tripId, rows.map((r) => r.t.id))).groupBy(itineraryItems.tripId);
    const sales = await this.db.select({ planId: planPurchases.planId, n: sql<number>`count(*)::int` }).from(planPurchases).where(and(inArray(planPurchases.planId, ids), isNull(planPurchases.refundedAt))).groupBy(planPurchases.planId);
    const owned = viewerId ? new Set((await this.db.select({ id: planPurchases.planId }).from(planPurchases).where(and(isNull(planPurchases.refundedAt), eq(planPurchases.buyerId, viewerId), inArray(planPurchases.planId, ids)))).map((x) => x.id)) : new Set<string>();
    return rows.map(({ p, t, u }) => {
      const status = this.status(p, t); const days = Math.round((Date.parse(t.endDate) - Date.parse(t.startDate)) / 86_400_000) + 1;
      return { id: p.id, tripId: t.id, title: t.title, place: t.place, countryCode: t.countryCode, imageKey: t.imageKey, summary: p.summary, days, stops: stops.find((s) => s.tripId === t.id)?.n ?? 0, price: p.mode === 'sell' || p.removedAt ? p.price : 0,
        status, opensAt: status === 'scheduled' ? saleOpensAt(t.endDate) : null, tripEnded: t.endDate < new Date(Date.now() + 3_600_000).toISOString().slice(0, 10), tripEndDate: t.endDate,
        used: sales.find((s) => s.planId === p.id)?.n ?? 0, author: author(u), mine: p.userId === viewerId, owned: owned.has(p.id) };
    });
  }

  /** What travellers can browse: free plans, and paid plans whose sale has opened. */
  async browse(q: { filter?: string; search?: string }, viewerId?: string) {
    const term = q.search?.trim();
    const rows = await this.base().where(and(isNull(plans.removedAt), inArray(plans.mode, ['free', 'sell']), eq(users.status, 'active'), term ? sql`(${ilike(trips.title, `%${term}%`)} OR ${ilike(trips.place, `%${term}%`)})` : undefined)).orderBy(desc(plans.createdAt)).limit(100);
    const list = (await this.view(rows, viewerId)).filter((p) => p.status === 'free' || p.status === 'on_sale');
    return q.filter === 'free' ? list.filter((p) => p.price === 0) : q.filter === 'paid' ? list.filter((p) => p.price > 0) : q.filter === 'weekend' ? list.filter((p) => p.days <= 3) : q.filter === 'owned' ? list.filter((p) => p.owned) : list;
  }

  /** A plan with its itinerary. Buyers and the owner see every day; everyone else sees day one. */
  async get(id: string, viewerId?: string) {
    const rows = await this.base().where(eq(plans.id, id));
    const [v] = await this.view(rows, viewerId);
    if (!v || v.status === 'removed' || (v.status === 'private' && !v.mine)) throw notFound('Trip plan');
    if (v.status === 'scheduled' && !v.mine) throw notFound('Trip plan');
    const items = await this.db.select().from(itineraryItems).where(eq(itineraryItems.tripId, v.tripId)).orderBy(itineraryItems.day, itineraryItems.time);
    const full = v.mine || v.owned || v.status === 'free';
    const firstDay = items[0]?.day;
    const shown = full ? items : items.filter((i) => i.day === firstDay);
    const dayNumber = (d: string) => Math.round((Date.parse(d) - Date.parse(rows[0]!.t.startDate)) / 86_400_000) + 1;
    return { ...v, unlocked: full, lockedStops: items.length - shown.length, itinerary: shown.map((i) => ({ day: dayNumber(i.day), time: i.time, title: i.title, note: i.note })) };
  }

  /** Lists a trip as private, free or for sale. Anyone can sell; getting paid needs a verified ID. */
  async list(userId: string, tripId: string, input: { mode: 'private' | 'free' | 'sell'; price?: number; summary?: string }) {
    const [t] = await this.db.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
    if (!t) throw notFound('Trip');
    const price = input.mode === 'sell' ? (input.price ?? 0) : 0;
    if (input.mode === 'sell' && price < RULES.minPlanPriceKobo) throw badRequest('price_too_low', `Set a price of at least ${naira(RULES.minPlanPriceKobo)}.`);
    const [{ n } = { n: 0 }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(itineraryItems).where(eq(itineraryItems.tripId, tripId));
    if (input.mode !== 'private' && n < 3) throw badRequest('plan_too_thin', 'Add at least 3 stops to the itinerary before you share this plan.');
    await this.db.insert(plans).values({ userId, tripId, mode: input.mode, price, summary: input.summary ?? '' })
      .onConflictDoUpdate({ target: plans.tripId, set: { mode: input.mode, price, ...(input.summary !== undefined && { summary: input.summary }) } });
    const [p] = await this.db.select({ id: plans.id }).from(plans).where(eq(plans.tripId, tripId));
    const view = await this.get(p!.id, userId);
    return { ...view, sellerGets: split(price).sellerAmount, fee: split(price).fee };
  }
  async listingForTrip(userId: string, tripId: string) {
    const [p] = await this.db.select({ id: plans.id }).from(plans).where(and(eq(plans.tripId, tripId), eq(plans.userId, userId)));
    return p ? this.get(p.id, userId) : null;
  }

  /** Buys a plan from the wallet's available balance: 25% to the platform, 75% held for the seller's next payout. */
  async buy(buyerId: string, planId: string, pin: string, idempotencyKey: string) {
    const plan = await this.get(planId, buyerId);
    if (plan.mine) throw conflict('own_plan', 'This is your own plan.');
    if (plan.owned) return { owned: true, repeated: true };
    if (plan.status === 'free') {
      await this.db.insert(planPurchases).values({ planId, buyerId, sellerId: plan.author.id, price: 0, fee: 0, sellerAmount: 0 }).onConflictDoNothing();
      return { owned: true, repeated: false };
    }
    await this.wallet.checkPin(buyerId, pin);
    const { fee, sellerAmount } = split(plan.price);
    await this.ledger.run(async (tx) => {
      const [dup] = await tx.select({ id: planPurchases.id }).from(planPurchases).where(and(eq(planPurchases.planId, planId), eq(planPurchases.buyerId, buyerId), isNull(planPurchases.refundedAt)));
      if (dup) return;
      const [buyer] = await tx.select({ frozen: users.walletFrozen }).from(users).where(eq(users.id, buyerId));
      if (buyer?.frozen) throw forbidden('wallet_frozen', 'Your wallet is frozen. Unfreeze it in Wallet settings first.');
      const from = await this.ledger.availableAccount(tx, buyerId);
      const transactionId = await this.ledger.post(tx, { kind: 'plan_sale', reference: newReference('PL'), userId: buyerId, idempotencyKey, description: `Trip plan · ${plan.title}`, metadata: { planId, sellerId: plan.author.id },
        entries: [{ accountId: from, amount: -plan.price }, { accountId: await this.ledger.systemAccount(tx, 'platform_fees'), amount: fee }, { accountId: await this.ledger.systemAccount(tx, 'creator_payable'), amount: sellerAmount }] });
      await tx.insert(planPurchases).values({ planId, buyerId, sellerId: plan.author.id, price: plan.price, fee, sellerAmount, transactionId })
        .onConflictDoUpdate({ target: [planPurchases.planId, planPurchases.buyerId], set: { price: plan.price, fee, sellerAmount, transactionId, refundedAt: null, paidOutAt: null, payoutReference: null } }); // buying again after a refund
      await notify(tx, plan.author.id, 'wallet', `Someone bought your plan "${plan.title}". ${naira(sellerAmount)} is in your next payout.`, '/creator-studio');
    });
    return { owned: true, repeated: false };
  }

  /** Creator studio: my listings, this month's sales and what is waiting for the next payout. */
  async studio(userId: string) {
    const mine = await this.view(await this.base().where(and(eq(plans.userId, userId), isNull(plans.removedAt))).orderBy(desc(plans.createdAt)), userId);
    const monthStart = new Date(Date.now() + 3_600_000); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const [m] = await this.db.select({ sales: sql<number>`count(*)::int`, gross: sql<number>`COALESCE(SUM(${planPurchases.price}), 0)::float8`, fee: sql<number>`COALESCE(SUM(${planPurchases.fee}), 0)::float8`, net: sql<number>`COALESCE(SUM(${planPurchases.sellerAmount}), 0)::float8` })
      .from(planPurchases).where(and(isNull(planPurchases.refundedAt), eq(planPurchases.sellerId, userId), sql`${planPurchases.price} > 0`, sql`${planPurchases.createdAt} >= ${new Date(monthStart.getTime() - 3_600_000)}`));
    const [w] = await this.db.select({ n: sql<number>`COALESCE(SUM(${planPurchases.sellerAmount}), 0)::float8` }).from(planPurchases).where(and(isNull(planPurchases.refundedAt), eq(planPurchases.sellerId, userId), isNull(planPurchases.paidOutAt)));
    const [u] = await this.db.select({ kyc: users.kycStatus }).from(users).where(eq(users.id, userId));
    return { month: { sales: m?.sales ?? 0, gross: Number(m?.gross ?? 0), fee: Number(m?.fee ?? 0), net: Number(m?.net ?? 0) }, waitingForPayout: Number(w?.n ?? 0), canBePaid: u?.kyc === 'verified', feePercent: RULES.planFeeRate * 100, plans: mine };
  }

  // ───────────── Staff: all plans ─────────────

  async adminList() {
    const rows = await this.base().where(sql`${plans.mode} IN ('free', 'sell') OR ${plans.removedAt} IS NOT NULL`).orderBy(desc(plans.createdAt)).limit(300);
    return this.view(rows);
  }

  /**
   * Takes a plan off the marketplace. With `refund`, every buyer whose money has not yet been paid
   * out to the seller gets it back in full; sales already paid out are left as they are.
   */
  async remove(planId: string, refund: boolean) {
    const [row] = await this.base().where(eq(plans.id, planId));
    if (!row) throw notFound('Trip plan');
    if (row.p.removedAt) throw conflict('already_removed', 'This plan has already been removed.');
    return this.ledger.run(async (tx) => {
      await tx.update(plans).set({ removedAt: new Date(), mode: 'private' }).where(eq(plans.id, planId));
      let refunded = 0; let total = 0; let alreadyPaidOut = 0;
      if (refund) {
        const sales = await tx.select().from(planPurchases).where(and(eq(planPurchases.planId, planId), isNull(planPurchases.refundedAt), sql`${planPurchases.price} > 0`));
        for (const s of sales) {
          if (s.paidOutAt) { alreadyPaidOut++; continue; }
          await this.ledger.post(tx, { kind: 'refund', reference: newReference('RF'), userId: s.buyerId, description: `Refund · ${row.t.title}`, metadata: { planId },
            entries: [{ accountId: await this.ledger.systemAccount(tx, 'creator_payable'), amount: -s.sellerAmount }, { accountId: await this.ledger.systemAccount(tx, 'platform_fees'), amount: -s.fee }, { accountId: await this.ledger.availableAccount(tx, s.buyerId), amount: s.price }] });
          await tx.update(planPurchases).set({ refundedAt: new Date() }).where(eq(planPurchases.id, s.id));
          await notify(tx, s.buyerId, 'wallet', `We removed the plan "${row.t.title}" and returned ${naira(s.price)} to your wallet.`, '/wallet/history');
          refunded++; total += s.price;
        }
      }
      await notify(tx, row.p.userId, 'community', `We removed your plan "${row.t.title}" from the marketplace because it broke the guidelines.`);
      return { title: row.t.title, refunded, total, alreadyPaidOut };
    });
  }

  // ───────────── Finance: payouts ─────────────

  /** What each seller is owed from sales not yet paid out. Sellers without a verified ID, or suspended, are held. */
  async payoutBatch() {
    const rows = await this.db.select({ sellerId: planPurchases.sellerId, name: users.name, email: users.email, kyc: users.kycStatus, status: users.status, sales: sql<number>`count(*)::int`, gross: sql<number>`SUM(${planPurchases.price})::float8`, fee: sql<number>`SUM(${planPurchases.fee})::float8`, owed: sql<number>`SUM(${planPurchases.sellerAmount})::float8` })
      .from(planPurchases).innerJoin(users, eq(users.id, planPurchases.sellerId)).where(and(isNull(planPurchases.refundedAt), isNull(planPurchases.paidOutAt), sql`${planPurchases.price} > 0`)).groupBy(planPurchases.sellerId, users.name, users.email, users.kycStatus, users.status).orderBy(sql`SUM(${planPurchases.sellerAmount}) DESC`);
    const sellers = rows.map((r) => ({ sellerId: r.sellerId, seller: r.name ?? 'Traveller', sales: r.sales, gross: Number(r.gross), fee: Number(r.fee), owed: Number(r.owed), held: r.status !== 'active' ? 'Account suspended' : r.kyc !== 'verified' ? 'ID not verified' : null }));
    const sum = (f: (s: (typeof sellers)[number]) => number) => sellers.reduce((n, s) => n + f(s), 0);
    return { sellers, totals: { gross: sum((s) => s.gross), fee: sum((s) => s.fee), paying: sum((s) => (s.held ? 0 : s.owed)), held: sum((s) => (s.held ? s.owed : 0)) } };
  }

  /** Pays every seller who can be paid: their share moves from "owed to creators" into their available balance. */
  async approvePayouts() {
    const batch = await this.payoutBatch(); const reference = newReference('PO'); let paid = 0; let total = 0;
    for (const s of batch.sellers.filter((x) => !x.held)) {
      await this.ledger.run(async (tx) => {
        const due = await tx.update(planPurchases).set({ paidOutAt: new Date(), payoutReference: reference }).where(and(isNull(planPurchases.refundedAt), eq(planPurchases.sellerId, s.sellerId), isNull(planPurchases.paidOutAt), sql`${planPurchases.price} > 0`)).returning({ amount: planPurchases.sellerAmount });
        const amount = due.reduce((n, d) => n + d.amount, 0);
        if (!amount) return;
        await this.ledger.post(tx, { kind: 'payout', reference: `${reference}-${s.sellerId.slice(0, 8)}`, userId: s.sellerId, description: `Trip plan earnings · ${due.length} sale${due.length === 1 ? '' : 's'}`,
          entries: [{ accountId: await this.ledger.systemAccount(tx, 'creator_payable'), amount: -amount }, { accountId: await this.ledger.availableAccount(tx, s.sellerId), amount }] });
        await notify(tx, s.sellerId, 'wallet', `${naira(amount)} from your trip plan sales is in your wallet.`, '/wallet/history');
        paid++; total += amount;
      });
    }
    return { reference, sellersPaid: paid, total, held: batch.totals.held };
  }
}
