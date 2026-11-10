import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { Database } from '../../db/db.module.js';
import { admins, advice, adviceHelpful, outbox, reports, tips, users } from '../../db/schema.js';
import { author } from './tips.service.js';

export interface AdviceInput { countryCode: string; city: string; topic: string; body: string; visited?: string; showPassport?: boolean }
type Status = (typeof advice.$inferSelect)['status'];
const QUEUES = { waiting: ['in_review'], changes: ['changes_requested'], rereview: ['rereview'], decided: ['verified', 'rejected'] } as const satisfies Record<string, readonly Status[]>;
export type Queue = keyof typeof QUEUES;

@Injectable()
export class AdviceService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  /** Per-country counts for the country list: all advice travellers can see, and how much of it is verified. */
  async countries() {
    return this.db.select({ code: advice.countryCode, total: sql<number>`count(*)::int`, verified: sql<number>`count(*) FILTER (WHERE ${advice.status} = 'verified')::int` })
      .from(advice).where(inArray(advice.status, ['verified', 'in_review'])).groupBy(advice.countryCode);
  }

  /**
   * Advice for a country. Verified advice always shows. Unreviewed advice shows only when the
   * traveller switches "Verified only" off. People always see their own, whatever its state.
   */
  async list(q: { countryCode: string; verifiedOnly: boolean }, viewerId?: string) {
    const visible: Status[] = q.verifiedOnly ? ['verified'] : ['verified', 'in_review'];
    const rows = await this.db.select({ a: advice, u: users }).from(advice).innerJoin(users, eq(users.id, advice.userId))
      .where(and(eq(advice.countryCode, q.countryCode.toUpperCase()), or(inArray(advice.status, visible), viewerId ? eq(advice.userId, viewerId) : undefined)))
      .orderBy(desc(advice.helpfulCount), desc(advice.createdAt)).limit(200);
    const marked = viewerId && rows.length ? new Set((await this.db.select({ id: adviceHelpful.adviceId }).from(adviceHelpful).where(and(eq(adviceHelpful.userId, viewerId), inArray(adviceHelpful.adviceId, rows.map((r) => r.a.id))))).map((x) => x.id)) : new Set<string>();
    return rows.map(({ a, u }) => {
      const mine = a.userId === viewerId;
      return { id: a.id, countryCode: a.countryCode, city: a.city, topic: a.topic, body: a.body, visited: a.visited, status: a.status, helpful: a.helpfulCount, createdAt: a.createdAt,
        author: { ...author(u), passportCountry: a.showPassport ? u.passportCountry : null }, mine, markedHelpful: marked.has(a.id), reviewNote: mine ? a.reviewNote : null };
    });
  }

  /** New advice always starts in the review queue. Nothing a traveller sends can set its status. */
  async create(userId: string, input: AdviceInput) {
    const [a] = await this.db.insert(advice).values({ userId, ...input, countryCode: input.countryCode.toUpperCase(), status: 'in_review' }).returning({ id: advice.id });
    return { id: a!.id, status: 'in_review' as const };
  }

  /** The author rewrites advice after "changes requested" (or while waiting); it goes back to the queue. */
  async revise(userId: string, id: string, body: string) {
    const [a] = await this.db.select().from(advice).where(eq(advice.id, id));
    if (!a || a.userId !== userId) throw notFound('Advice');
    if (a.status === 'verified' || a.status === 'rereview') throw conflict('already_verified', 'Verified advice cannot be edited. Post new advice instead.');
    await this.db.update(advice).set({ body, status: 'in_review', reviewNote: null, reviewedAt: null, reviewedBy: null, createdAt: new Date() }).where(eq(advice.id, id));
    return { id, status: 'in_review' as const };
  }

  async toggleHelpful(userId: string, id: string) {
    const [a] = await this.db.select({ userId: advice.userId, status: advice.status }).from(advice).where(eq(advice.id, id));
    if (!a) throw notFound('Advice');
    if (a.userId === userId) throw forbidden('own_content', 'You cannot mark your own advice as helpful.');
    return this.db.transaction(async (tx) => {
      const removed = await tx.delete(adviceHelpful).where(and(eq(adviceHelpful.adviceId, id), eq(adviceHelpful.userId, userId))).returning({ id: adviceHelpful.adviceId });
      if (!removed.length) await tx.insert(adviceHelpful).values({ adviceId: id, userId });
      const [row] = await tx.update(advice).set({ helpfulCount: sql`${advice.helpfulCount} + ${removed.length ? -1 : 1}` }).where(eq(advice.id, id)).returning({ helpful: advice.helpfulCount });
      return { markedHelpful: !removed.length, helpful: row!.helpful };
    });
  }

  // ───────────── Staff ─────────────

  async reviewQueue(queue: Queue) {
    const counts = Object.fromEntries((await this.db.select({ status: advice.status, n: sql<number>`count(*)::int` }).from(advice).groupBy(advice.status)).map((r) => [r.status, r.n])) as Partial<Record<Status, number>>;
    const rows = await this.db.select({ a: advice, u: users, reviewer: admins.name }).from(advice).innerJoin(users, eq(users.id, advice.userId)).leftJoin(admins, eq(admins.id, advice.reviewedBy))
      .where(inArray(advice.status, [...QUEUES[queue]])).orderBy(queue === 'decided' ? desc(advice.reviewedAt) : advice.createdAt).limit(100);
    const ids = [...new Set(rows.map((r) => r.u.id))];
    const record = ids.length ? await this.db.select({ userId: advice.userId, approved: sql<number>`count(*) FILTER (WHERE ${advice.status} = 'verified')::int`, rejected: sql<number>`count(*) FILTER (WHERE ${advice.status} = 'rejected')::int` }).from(advice).where(inArray(advice.userId, ids)).groupBy(advice.userId) : [];
    const tipCounts = ids.length ? await this.db.select({ userId: tips.userId, n: sql<number>`count(*)::int`, places: sql<string[]>`array_agg(DISTINCT ${tips.place})` }).from(tips).where(and(inArray(tips.userId, ids), eq(tips.status, 'published'))).groupBy(tips.userId) : [];
    const reportCounts = rows.length ? await this.db.select({ id: reports.targetId, n: sql<number>`count(*)::int`, reasons: sql<string[]>`array_agg(DISTINCT ${reports.reason})` }).from(reports).where(and(eq(reports.targetType, 'advice'), inArray(reports.targetId, rows.map((r) => r.a.id)), isNull(reports.resolvedAt))).groupBy(reports.targetId) : [];
    return {
      counts: { waiting: counts.in_review ?? 0, changes: counts.changes_requested ?? 0, rereview: counts.rereview ?? 0, decided: (counts.verified ?? 0) + (counts.rejected ?? 0) },
      items: rows.map(({ a, u, reviewer }) => {
        const r = record.find((x) => x.userId === u.id); const t = tipCounts.find((x) => x.userId === u.id); const rep = reportCounts.find((x) => x.id === a.id);
        // Until trips are stored, the only evidence of a visit is a tip the author posted from the same place.
        const matchingTips = (t?.places ?? []).filter((p) => p.toLowerCase().includes(a.city.toLowerCase()) || a.city.toLowerCase().includes(p.split(',')[0]!.toLowerCase()));
        return { id: a.id, countryCode: a.countryCode, city: a.city, topic: a.topic, body: a.body, visited: a.visited, status: a.status, submittedAt: a.createdAt, reviewNote: a.reviewNote, reviewedBy: reviewer, reviewedAt: a.reviewedAt,
          reports: rep?.n ?? 0, reportReasons: rep?.reasons ?? [], evidence: matchingTips.map((p) => `Posted a tip from ${p}`),
          author: { id: u.id, name: u.name ?? 'Traveller', since: u.createdAt, passportCountry: u.passportCountry, tips: t?.n ?? 0, approved: r?.approved ?? 0, rejected: r?.rejected ?? 0 } };
      }),
    };
  }

  /** The only way advice becomes Verified. */
  async decide(id: string, decision: 'approve' | 'changes' | 'reject', adminId: string, note?: string) {
    if (decision !== 'approve' && (!note || note.length < 5)) throw badRequest('note_required', 'Add a note to the author before you request changes or reject.');
    const status: Status = decision === 'approve' ? 'verified' : decision === 'changes' ? 'changes_requested' : 'rejected';
    return this.db.transaction(async (tx) => {
      const [a] = await tx.update(advice).set({ status, reviewNote: decision === 'approve' ? null : note, reviewedBy: adminId, reviewedAt: new Date() })
        .where(and(eq(advice.id, id), inArray(advice.status, ['in_review', 'rereview', 'changes_requested']))).returning();
      if (!a) throw conflict('already_decided', 'This advice has already been decided, or no longer exists.');
      await tx.update(reports).set({ resolvedAt: new Date() }).where(and(eq(reports.targetType, 'advice'), eq(reports.targetId, id), isNull(reports.resolvedAt)));
      await tx.insert(outbox).values({ topic: 'advice.decided', payload: { adviceId: id, userId: a.userId, status, note: note ?? null } });
      return { status, countryCode: a.countryCode, excerpt: a.body.length > 50 ? `${a.body.slice(0, 50)}…` : a.body };
    });
  }
}
