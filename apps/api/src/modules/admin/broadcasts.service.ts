import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { badRequest, conflict } from '../../common/errors.js';
import { Database } from '../../db/db.module.js';
import { admins, broadcasts } from '../../db/schema.js';

/** Who a broadcast can go to. Each is a condition on the users table (aliased u). Suspended accounts never get one. */
export const AUDIENCES = {
  everyone: { label: 'Everyone', where: sql`TRUE` },
  verified: { label: 'Travellers with a verified wallet', where: sql`u.kyc_status = 'verified'` },
  travelling_soon: { label: 'Travelling in the next 30 days', where: sql`EXISTS (SELECT 1 FROM trips t WHERE t.user_id = u.id AND t.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)` },
  sellers: { label: 'Plan sellers', where: sql`EXISTS (SELECT 1 FROM plans p WHERE p.user_id = u.id AND p.mode = 'sell' AND p.removed_at IS NULL)` },
  shoppers: { label: 'Shop customers', where: sql`EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)` },
} satisfies Record<string, { label: string; where: SQL }>;
export type Audience = keyof typeof AUDIENCES;
/** Screens a broadcast can open when tapped. */
export const TARGETS = { '': 'Nothing (message only)', '/explore': 'Explore', '/shop': 'Shop', '/wallet': 'Wallet', '/plans': 'Trip plans', '/advice': 'Travel advice', '/travels': 'My travels' } as const;

@Injectable()
export class BroadcastsService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  /** What the compose form needs: each audience with how many travellers it reaches right now, and where a message can lead. */
  async options() {
    const audiences = await Promise.all((Object.keys(AUDIENCES) as Audience[]).map(async (id) => {
      const r = await this.db.execute(sql`SELECT count(*)::int AS n FROM users u WHERE u.status = 'active' AND ${AUDIENCES[id].where}`);
      return { id, label: AUDIENCES[id].label, people: (r.rows[0] as { n: number }).n };
    }));
    return { audiences, targets: Object.entries(TARGETS).map(([href, label]) => ({ href, label })) };
  }

  /** Sends now, or stores the message to go out at `sendAt` (the timed job delivers it). */
  async send(adminId: string, input: { title: string; message: string; audience: Audience; href?: string; sendAt?: string }) {
    const at = input.sendAt ? new Date(input.sendAt) : null;
    if (at && at.getTime() < Date.now() + 60_000) throw badRequest('too_soon', 'Choose a time at least a minute from now, or send it now.');
    if (at && at.getTime() > Date.now() + 90 * 86_400_000) throw badRequest('too_far', 'Choose a time within the next 90 days.');
    const [b] = await this.db.insert(broadcasts).values({ adminId, title: input.title, message: input.message, audience: input.audience, href: input.href || null, sendAt: at }).returning();
    const recipients = at ? 0 : await this.deliver(b!.id);
    return { id: b!.id, title: b!.title, audience: AUDIENCES[input.audience].label, recipients, sendAt: at };
  }

  /** Puts the message in each traveller's in-app notifications, all or nothing. Safe to call twice: only the first call sends. */
  async deliver(id: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [b] = await tx.update(broadcasts).set({ sentAt: new Date() }).where(and(eq(broadcasts.id, id), isNull(broadcasts.sentAt), isNull(broadcasts.cancelledAt))).returning();
      if (!b) return 0;
      const sent = await tx.execute(sql`INSERT INTO notifications (user_id, type, text, href, broadcast_id)
        SELECT u.id, 'news', ${`${b.title}\n${b.message}`}, ${b.href}, ${b.id}::uuid FROM users u WHERE u.status = 'active' AND ${AUDIENCES[b.audience as Audience]?.where ?? sql`FALSE`}`);
      const recipients = sent.rowCount ?? 0;
      await tx.update(broadcasts).set({ recipients }).where(eq(broadcasts.id, b.id));
      return recipients;
    });
  }

  /** The timed job: everything whose time has come. Returns how many messages went out. */
  async deliverDue(): Promise<number> {
    const due = await this.db.select({ id: broadcasts.id }).from(broadcasts).where(and(isNull(broadcasts.sentAt), isNull(broadcasts.cancelledAt), lte(broadcasts.sendAt, new Date()))).limit(20);
    for (const b of due) await this.deliver(b.id);
    return due.length;
  }

  async cancel(id: string) {
    const [b] = await this.db.update(broadcasts).set({ cancelledAt: new Date() }).where(and(eq(broadcasts.id, id), isNull(broadcasts.sentAt), isNull(broadcasts.cancelledAt))).returning();
    if (!b) throw conflict('not_scheduled', 'That notification has already been sent or cancelled.');
    return { title: b.title };
  }

  async list() {
    const rows = await this.db.select({ b: broadcasts, by: admins.name, opened: sql<number>`(SELECT count(*)::int FROM notifications n WHERE n.broadcast_id = ${broadcasts.id} AND n.read_at IS NOT NULL)` })
      .from(broadcasts).innerJoin(admins, eq(admins.id, broadcasts.adminId)).orderBy(desc(broadcasts.createdAt)).limit(100);
    return rows.map(({ b, by, opened }) => ({ id: b.id, status: b.cancelledAt ? 'cancelled' as const : b.sentAt ? 'sent' as const : 'scheduled' as const, sentAt: b.sentAt, sendAt: b.sendAt, sentBy: by, title: b.title, message: b.message, audience: AUDIENCES[b.audience as Audience]?.label ?? b.audience, opens: TARGETS[(b.href ?? '') as keyof typeof TARGETS] ?? b.href, recipients: b.recipients, opened }));
  }
}
