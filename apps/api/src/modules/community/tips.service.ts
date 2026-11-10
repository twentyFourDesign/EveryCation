import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { conflict, notFound } from '../../common/errors.js';
import { RULES } from '../../config.js';
import { notify } from '../../common/notify.js';
import { MediaService } from '../media/media.service.js';
import { Database } from '../../db/db.module.js';
import { advice, comments, reports, tipLikes, tips, users } from '../../db/schema.js';

export interface TipInput { title: string; place: string; countryCode?: string; category: string; format: 'write' | 'video' | 'voice'; body: string; goodToKnow?: string[]; imageKey?: string; mediaId?: string; visited?: string }
export const author = (u: { id: string; name: string | null; handle: string | null; city: string | null }) => ({ id: u.id, name: u.name ?? 'Traveller', handle: u.handle, city: u.city });

@Injectable()
export class TipsService {
  constructor(private readonly database: Database, private readonly media: MediaService) {}
  private get db() { return this.database.db; }

  private async view(rows: { t: typeof tips.$inferSelect; u: typeof users.$inferSelect }[], viewerId?: string) {
    const liked = viewerId && rows.length ? new Set((await this.db.select({ id: tipLikes.tipId }).from(tipLikes).where(and(eq(tipLikes.userId, viewerId), inArray(tipLikes.tipId, rows.map((r) => r.t.id))))).map((l) => l.id)) : new Set<string>();
    const files = await this.media.views(rows.map((r) => r.t.mediaId).filter((x): x is string => !!x));
    return rows.map(({ t, u }) => ({ media: (t.mediaId && files.get(t.mediaId)) || null, id: t.id, title: t.title, place: t.place, countryCode: t.countryCode, category: t.category, format: t.format, body: t.body, goodToKnow: t.goodToKnow, imageKey: t.imageKey, visited: t.visited,
      likes: t.likeCount, comments: t.commentCount, createdAt: t.createdAt, author: author(u), liked: liked.has(t.id), mine: t.userId === viewerId }));
  }

  async list(q: { feed?: 'latest' | 'popular'; authorId?: string; search?: string; limit?: number }, viewerId?: string) {
    const term = q.search?.trim();
    const rows = await this.db.select({ t: tips, u: users }).from(tips).innerJoin(users, eq(users.id, tips.userId))
      .where(and(eq(tips.status, 'published'), q.authorId ? eq(tips.userId, q.authorId) : undefined, term ? or(ilike(tips.title, `%${term}%`), ilike(tips.place, `%${term}%`)) : undefined))
      .orderBy(...(q.feed === 'popular' ? [desc(tips.likeCount), desc(tips.createdAt)] : [desc(tips.createdAt)])).limit(Math.min(q.limit ?? 30, 60));
    return this.view(rows, viewerId);
  }

  async get(id: string, viewerId?: string) {
    const rows = await this.db.select({ t: tips, u: users }).from(tips).innerJoin(users, eq(users.id, tips.userId)).where(and(eq(tips.id, id), eq(tips.status, 'published')));
    if (!rows.length) throw notFound('Tip');
    return (await this.view(rows, viewerId))[0]!;
  }

  async create(userId: string, input: TipInput) {
    if (input.mediaId && !(await this.media.owned(userId, input.mediaId))) throw notFound('That upload');
    const [t] = await this.db.insert(tips).values({ userId, ...input, countryCode: input.countryCode?.toUpperCase() }).returning({ id: tips.id });
    return this.get(t!.id, userId);
  }

  /** Likes or unlikes. The count is changed in the same transaction as the like, so it cannot drift. */
  async toggleLike(userId: string, tipId: string) {
    await this.get(tipId);
    return this.db.transaction(async (tx) => {
      const removed = await tx.delete(tipLikes).where(and(eq(tipLikes.tipId, tipId), eq(tipLikes.userId, userId))).returning({ id: tipLikes.tipId });
      if (!removed.length) await tx.insert(tipLikes).values({ tipId, userId });
      const [t] = await tx.update(tips).set({ likeCount: sql`${tips.likeCount} + ${removed.length ? -1 : 1}` }).where(eq(tips.id, tipId)).returning({ likes: tips.likeCount });
      return { liked: !removed.length, likes: t!.likes };
    });
  }

  async comments(tipId: string, viewerId?: string) {
    const [tip] = await this.db.select({ owner: tips.userId }).from(tips).where(eq(tips.id, tipId));
    if (!tip) throw notFound('Tip');
    const rows = await this.db.select({ c: comments, u: users }).from(comments).innerJoin(users, eq(users.id, comments.userId)).where(and(eq(comments.tipId, tipId), eq(comments.status, 'published'))).orderBy(comments.createdAt).limit(200);
    return rows.map(({ c, u }) => ({ id: c.id, body: c.body, createdAt: c.createdAt, author: author(u), isTipAuthor: c.userId === tip.owner, mine: c.userId === viewerId }));
  }

  async addComment(userId: string, tipId: string, body: string) {
    const tip = await this.get(tipId);
    const [me] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    await this.db.transaction(async (tx) => {
      await tx.insert(comments).values({ tipId, userId, body });
      await tx.update(tips).set({ commentCount: sql`${tips.commentCount} + 1` }).where(eq(tips.id, tipId));
      if (tip.author.id !== userId) await notify(tx, tip.author.id, 'community', `${me?.name ?? 'A traveller'} commented on your tip "${tip.title}"`, `/tip/${tipId}/comments`);
    });
    return this.comments(tipId, userId);
  }

  /** One report per person per item. Enough reports on verified advice send it back to the review queue. */
  async report(userId: string, targetType: 'tip' | 'comment' | 'advice', targetId: string, reason: string) {
    const table = { tip: tips, comment: comments, advice }[targetType];
    const [target] = await this.db.select({ id: table.id, userId: table.userId }).from(table).where(eq(table.id, targetId));
    if (!target) throw notFound('That item');
    if (target.userId === userId) throw conflict('own_content', 'You cannot report your own post.');
    const added = await this.db.insert(reports).values({ targetType, targetId, reporterId: userId, reason }).onConflictDoNothing().returning({ id: reports.id });
    if (targetType === 'advice' && added.length) {
      const [{ n } = { n: 0 }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(reports).where(and(eq(reports.targetType, 'advice'), eq(reports.targetId, targetId), sql`${reports.resolvedAt} IS NULL`));
      if (n >= RULES.reportsToRereview) await this.db.update(advice).set({ status: 'rereview' }).where(and(eq(advice.id, targetId), eq(advice.status, 'verified')));
    }
    return { reported: true, alreadyReported: !added.length };
  }

  async profile(userId: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!u) throw notFound('Traveller');
    const [t] = await this.db.select({ n: sql<number>`count(*)::int`, countries: sql<number>`count(DISTINCT ${tips.countryCode})::int` }).from(tips).where(and(eq(tips.userId, userId), eq(tips.status, 'published')));
    const [a] = await this.db.select({ n: sql<number>`count(*)::int` }).from(advice).where(and(eq(advice.userId, userId), eq(advice.status, 'verified')));
    return { ...author(u), bio: u.bio, memberSince: u.createdAt, tips: t!.n, countries: t!.countries, verifiedAdvice: a!.n };
  }
}
