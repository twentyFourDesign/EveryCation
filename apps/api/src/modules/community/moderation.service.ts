import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { badRequest, conflict, notFound } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { because, reasonLabel, WHY_MESSAGE, type Why } from '../../common/reasons.js';
import { Database } from '../../db/db.module.js';
import { advice, comments, momentComments, moments, reports, sessions, tips, users } from '../../db/schema.js';

type Target = 'tip' | 'comment' | 'advice' | 'moment' | 'moment_comment';
const TARGETS: Target[] = ['tip', 'comment', 'advice', 'moment', 'moment_comment'];
const NOUN: Record<Target, string> = { tip: 'tip', comment: 'comment', advice: 'advice', moment: 'moment', moment_comment: 'comment' };
const excerpt = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** What travellers reported, grouped by the item, and what staff decided about it. */
@Injectable()
export class ModerationService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  private async content(type: Target, ids: string[]) {
    if (!ids.length) return new Map<string, { title: string; body: string; authorId: string; removed: boolean }>();
    const rows = type === 'tip' ? (await this.db.select().from(tips).where(inArray(tips.id, ids))).map((t) => ({ id: t.id, title: `Tip · "${t.title}"`, body: t.body, authorId: t.userId, removed: t.status === 'removed' }))
      : type === 'comment' ? (await this.db.select({ c: comments, tip: tips.title }).from(comments).innerJoin(tips, eq(tips.id, comments.tipId)).where(inArray(comments.id, ids))).map(({ c, tip }) => ({ id: c.id, title: `Comment on "${tip}"`, body: c.body, authorId: c.userId, removed: c.status === 'removed' }))
      : type === 'moment' ? (await this.db.select().from(moments).where(inArray(moments.id, ids))).map((m) => ({ id: m.id, title: `Moment · ${m.kind}${m.place ? ` · ${m.place}` : ''}`, body: m.body || '(photo, video or voice note only)', authorId: m.userId, removed: m.status === 'removed' }))
      : type === 'moment_comment' ? (await this.db.select({ c: momentComments, m: moments.body }).from(momentComments).innerJoin(moments, eq(moments.id, momentComments.momentId)).where(inArray(momentComments.id, ids))).map(({ c, m }) => ({ id: c.id, title: `Comment on a moment${m ? ` · "${excerpt(m, 40)}"` : ''}`, body: c.body, authorId: c.userId, removed: c.status === 'removed' }))
      : (await this.db.select().from(advice).where(inArray(advice.id, ids))).map((a) => ({ id: a.id, title: `Advice · ${a.city} · ${a.topic}`, body: a.body, authorId: a.userId, removed: a.status === 'rejected' }));
    return new Map(rows.map((r) => [r.id, r]));
  }

  async queue(status: 'open' | 'closed') {
    const groups = await this.db.select({ type: reports.targetType, id: reports.targetId, n: sql<number>`count(*)::int`, reasons: sql<string[]>`array_agg(DISTINCT ${reports.reason})`, first: sql<Date>`min(${reports.createdAt})`, last: sql<Date>`max(${reports.createdAt})` })
      .from(reports).where(status === 'open' ? isNull(reports.resolvedAt) : isNotNull(reports.resolvedAt)).groupBy(reports.targetType, reports.targetId).orderBy(sql`count(*) DESC`, sql`min(${reports.createdAt})`).limit(200);
    const byType = Object.fromEntries(await Promise.all(TARGETS.map(async (t) => [t, await this.content(t, groups.filter((g) => g.type === t).map((g) => g.id))] as const))) as Record<Target, Awaited<ReturnType<ModerationService['content']>>>;
    const authorIds = [...new Set(groups.map((g) => byType[g.type].get(g.id)?.authorId).filter((x): x is string => !!x))];
    const authors = authorIds.length ? await this.db.select({ id: users.id, name: users.name, status: users.status }).from(users).where(inArray(users.id, authorIds)) : [];
    return groups.map((g) => {
      const c = byType[g.type].get(g.id); const a = authors.find((x) => x.id === c?.authorId);
      return { targetType: g.type, targetId: g.id, reports: g.n, priority: g.n >= 3 ? 'High' as const : 'Normal' as const, reasons: g.reasons, openedAt: g.first, lastAt: g.last,
        item: c?.title ?? 'Deleted item', body: c ? excerpt(c.body, 400) : '', removed: c?.removed ?? true, author: a ? { id: a.id, name: a.name ?? 'Traveller', suspended: a.status === 'suspended' } : null };
    });
  }

  /** Remove the item or keep it. Either way the open reports are closed; a removal tells the author. */
  async decide(type: Target, id: string, decision: 'remove' | 'keep', suspendAuthor: boolean, why?: Why) {
    if (decision === 'remove' && !why) throw badRequest('reason_required', WHY_MESSAGE);
    const c = (await this.content(type, [id])).get(id);
    if (!c) throw notFound('That item');
    return this.db.transaction(async (tx) => {
      const closed = await tx.update(reports).set({ resolvedAt: new Date() }).where(and(eq(reports.targetType, type), eq(reports.targetId, id), isNull(reports.resolvedAt))).returning({ id: reports.id });
      if (!closed.length) throw conflict('no_open_reports', 'There are no open reports on this item.');
      if (decision === 'remove' && !c.removed) {
        if (type === 'tip') await tx.update(tips).set({ status: 'removed' }).where(eq(tips.id, id));
        if (type === 'comment') { const [row] = await tx.update(comments).set({ status: 'removed' }).where(eq(comments.id, id)).returning({ tipId: comments.tipId }); await tx.update(tips).set({ commentCount: sql`GREATEST(${tips.commentCount} - 1, 0)` }).where(eq(tips.id, row!.tipId)); }
        if (type === 'moment') await tx.update(moments).set({ status: 'removed' }).where(eq(moments.id, id));
        if (type === 'moment_comment') { const [row] = await tx.update(momentComments).set({ status: 'removed' }).where(eq(momentComments.id, id)).returning({ momentId: momentComments.momentId }); await tx.update(moments).set({ commentCount: sql`GREATEST(${moments.commentCount} - 1, 0)` }).where(eq(moments.id, row!.momentId)); }
        if (type === 'advice') await tx.update(advice).set({ status: 'rejected', reviewNote: `Removed after reports from travellers. ${reasonLabel(why!)}`, reviewedAt: new Date() }).where(eq(advice.id, id));
        await notify(tx, c.authorId, 'community', `We removed your ${NOUN[type]} after reports from travellers ${because(why!)} It was: ${excerpt(c.title, 60)}`);
      } else if (type === 'advice' && decision === 'keep') {
        await tx.update(advice).set({ status: 'verified' }).where(and(eq(advice.id, id), eq(advice.status, 'rereview')));
      }
      if (suspendAuthor) {
        await tx.update(users).set({ status: 'suspended', walletFrozen: true }).where(eq(users.id, c.authorId));
        await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, c.authorId), isNull(sessions.revokedAt)));
      }
      return { decision, reason: decision === 'remove' && why ? reasonLabel(why) : null, reportsClosed: closed.length, item: excerpt(c.title, 70), suspended: suspendAuthor };
    });
  }
}
