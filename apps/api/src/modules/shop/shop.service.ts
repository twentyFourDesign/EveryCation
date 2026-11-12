import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { RULES } from '../../config.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { Database } from '../../db/db.module.js';
import { orderItems, orders, products, savingsGoals, users } from '../../db/schema.js';
import { Ledger, newReference } from '../wallet/ledger.service.js';
import { WalletService } from '../wallet/wallet.service.js';

const naira = (k: number) => `₦${(k / 100).toLocaleString('en-NG')}`;
type Delivery = keyof typeof RULES.delivery;
export interface OrderInput { items: { productId: string; qty: number }[]; delivery: Delivery; address: string; phone: string; goalId?: string; pin: string }
const productView = (p: typeof products.$inferSelect) => ({ id: p.id, name: p.name, brand: p.brand, category: p.category, price: p.price, imageKey: p.imageKey, imageUrl: p.imageUrl, variant: p.variant, description: p.description, pickedNote: p.pickedNote, digital: p.stock === null, inStock: p.stock === null || p.stock > 0, lowStock: p.stock !== null && p.stock > 0 && p.stock < 10 });
const NEXT: Record<string, string[]> = { placed: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };

@Injectable()
export class ShopService {
  constructor(private readonly database: Database, private readonly ledger: Ledger, private readonly wallet: WalletService) {}
  private get db() { return this.database.db; }

  async products(q: { category?: string; search?: string }) {
    const term = q.search?.trim();
    const rows = await this.db.select().from(products).where(and(eq(products.active, true), q.category ? eq(products.category, q.category) : undefined, term ? or(ilike(products.name, `%${term}%`), ilike(products.brand, `%${term}%`)) : undefined)).orderBy(desc(products.createdAt)).limit(100);
    return rows.map(productView);
  }
  async product(id: string) { const [p] = await this.db.select().from(products).where(and(eq(products.id, id), eq(products.active, true))); if (!p) throw notFound('Product'); return productView(p); }
  async categories() { return this.db.select({ category: products.category, count: sql<number>`count(*)::int` }).from(products).where(eq(products.active, true)).groupBy(products.category).orderBy(products.category); }
  deliveryOptions() { return Object.entries(RULES.delivery).map(([id, d]) => ({ id, ...d })); }

  /**
   * Places an order and pays for it from the wallet in one step: the chosen savings goal first,
   * then the available balance. Stock, payment and the order are saved together or not at all.
   */
  async placeOrder(userId: string, input: OrderInput, idempotencyKey: string) {
    if (!input.items.length) throw badRequest('basket_empty', 'Your basket is empty.');
    const [done] = await this.db.select().from(orders).innerJoin(users, eq(users.id, orders.userId)).where(and(eq(orders.userId, userId), sql`${orders.transactionId} IN (SELECT id FROM ledger_transactions WHERE idempotency_key = ${idempotencyKey})`));
    if (done) return { ...(await this.order(userId, done.orders.id)), repeated: true };
    await this.wallet.checkPin(userId, input.pin);
    const delivery = RULES.delivery[input.delivery];

    const orderId = await this.ledger.run(async (tx) => {
      const repeat = await this.ledger.findByKey(tx, userId, idempotencyKey);
      if (repeat) { const [o] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.transactionId, repeat.id)); return o!.id; }
      const [u] = await tx.select({ frozen: users.walletFrozen }).from(users).where(eq(users.id, userId));
      if (u?.frozen) throw forbidden('wallet_frozen', 'Your wallet is frozen. Unfreeze it in Wallet settings first.');

      const rows = await tx.select().from(products).where(and(inArray(products.id, input.items.map((i) => i.productId)), eq(products.active, true)));
      const lines = input.items.map((i) => { const p = rows.find((r) => r.id === i.productId); if (!p) throw notFound('One of the products'); return { p, qty: i.qty }; });
      for (const { p, qty } of lines) {
        if (p.stock === null) continue;
        const left = await tx.update(products).set({ stock: sql`${products.stock} - ${qty}` }).where(and(eq(products.id, p.id), gte(products.stock, qty))).returning({ id: products.id });
        if (!left.length) throw conflict('out_of_stock', p.stock === 0 ? `${p.name} is sold out.` : `Only ${p.stock} of ${p.name} left. Reduce the quantity.`);
      }
      const allDigital = lines.every((l) => l.p.stock === null);
      const subtotal = lines.reduce((n, l) => n + l.p.price * l.qty, 0); const deliveryFee = allDigital ? 0 : delivery.fee; const total = subtotal + deliveryFee;

      const available = await this.ledger.availableAccount(tx, userId);
      const entries: { accountId: string; amount: number }[] = []; let fromGoal = 0; let goalName: string | null = null;
      if (input.goalId) {
        const [g] = await tx.select({ g: savingsGoals, balance: sql<number>`(SELECT balance FROM ledger_accounts WHERE id = ${savingsGoals.accountId})::float8` }).from(savingsGoals).where(and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, userId), isNull(savingsGoals.closedAt)));
        if (!g) throw notFound('Goal');
        if (g.g.locked) throw forbidden('goal_locked', `${g.g.name} is locked. Unlock it first to pay from it.`);
        fromGoal = Math.min(Number(g.balance), total); goalName = g.g.name;
        if (fromGoal > 0) entries.push({ accountId: g.g.accountId, amount: -fromGoal });
      }
      if (total - fromGoal > 0) entries.push({ accountId: available, amount: -(total - fromGoal) });
      entries.push({ accountId: await this.ledger.systemAccount(tx, 'shop_revenue'), amount: total });
      const reference = newReference('SH');
      const transactionId = await this.ledger.post(tx, { kind: 'purchase', reference, userId, idempotencyKey, description: `Shop order · ${lines.length} item${lines.length === 1 ? '' : 's'}`, entries });
      const [o] = await tx.insert(orders).values({ userId, reference, subtotal, deliveryFee, total, paidFromGoal: fromGoal, goalName, delivery: allDigital ? 'Sent by email' : delivery.label, address: input.address, phone: input.phone, transactionId }).returning({ id: orders.id });
      await tx.insert(orderItems).values(lines.map((l) => ({ orderId: o!.id, productId: l.p.id, name: l.p.name, imageKey: l.p.imageKey, price: l.p.price, qty: l.qty })));
      await notify(tx, userId, 'shop', `Order ${reference} placed. ${naira(total)} paid from your wallet.`, `/shop/order/${o!.id}`);
      return o!.id;
    });
    return { ...(await this.order(userId, orderId)), repeated: false };
  }

  private async orderView(o: typeof orders.$inferSelect) {
    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    return { id: o.id, reference: o.reference, status: o.status, subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total, paidFromGoal: o.paidFromGoal, goalName: o.goalName, delivery: o.delivery, address: o.address, placedAt: o.createdAt, updatedAt: o.updatedAt,
      items: items.map((i) => ({ productId: i.productId, name: i.name, imageKey: i.imageKey, price: i.price, qty: i.qty })) };
  }
  async order(userId: string, id: string) { const [o] = await this.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))); if (!o) throw notFound('Order'); return this.orderView(o); }
  async myOrders(userId: string) { const rows = await this.db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(50); return Promise.all(rows.map((o) => this.orderView(o))); }

  // ───────────── Shop ops: products ─────────────
  async adminProducts() {
    const rows = await this.db.select().from(products).orderBy(desc(products.createdAt)).limit(500);
    const sold = await this.db.execute(sql`SELECT i.product_id AS id, COALESCE(SUM(i.qty), 0)::int AS n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'cancelled' AND o.created_at > now() - interval '30 days' GROUP BY i.product_id`);
    const by = new Map((sold.rows as { id: string; n: number }[]).map((r) => [r.id, r.n]));
    return rows.map((p) => ({ ...productView(p), stock: p.stock, active: p.active, sold30d: by.get(p.id) ?? 0 }));
  }
  async saveProduct(id: string | null, input: Partial<typeof products.$inferInsert>) {
    if (id) { const [p] = await this.db.update(products).set(input).where(eq(products.id, id)).returning(); if (!p) throw notFound('Product'); return p; }
    const [p] = await this.db.insert(products).values(input as typeof products.$inferInsert).returning();
    return p!;
  }

  // ───────────── Shop ops ─────────────
  async allOrders(status?: string) {
    const rows = await this.db.select({ o: orders, name: users.name, email: users.email }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(status ? eq(orders.status, status as typeof orders.$inferSelect.status) : undefined).orderBy(desc(orders.createdAt)).limit(200);
    const counts = Object.fromEntries((await this.db.select({ s: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status)).map((r) => [r.s, r.n]));
    return { counts, orders: await Promise.all(rows.map(async ({ o, name }) => ({ ...(await this.orderView(o)), customer: name ?? 'Traveller' }))) };
  }
  /** Moves an order one step on. A cancelled order is refunded to the available balance and its stock returned. */
  async setStatus(id: string, status: 'packed' | 'shipped' | 'delivered' | 'cancelled') {
    return this.ledger.run(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!o) throw notFound('Order');
      if (!NEXT[o.status]!.includes(status)) throw conflict('wrong_step', `An order that is ${o.status} cannot be marked ${status}.`);
      await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
      if (status === 'cancelled') {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
        for (const i of items) await tx.update(products).set({ stock: sql`${products.stock} + ${i.qty}` }).where(and(eq(products.id, i.productId), sql`${products.stock} IS NOT NULL`));
        await this.ledger.post(tx, { kind: 'refund', reference: `${o.reference}-REF`, userId: o.userId, description: `Refund for order ${o.reference}`, entries: [{ accountId: await this.ledger.systemAccount(tx, 'shop_revenue'), amount: -o.total }, { accountId: await this.ledger.availableAccount(tx, o.userId), amount: o.total }] });
      }
      const text = { packed: `Your order ${o.reference} is packed and ready to ship.`, shipped: `Your order ${o.reference} is on its way.`, delivered: `Your order ${o.reference} was delivered. Enjoy your trip.`, cancelled: `Your order ${o.reference} was cancelled. ${naira(o.total)} is back in your wallet.` }[status];
      await notify(tx, o.userId, 'shop', text, `/shop/order/${o.id}`);
      return { reference: o.reference, status };
    });
  }
}
