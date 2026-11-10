import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { badRequest, notFound } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { Database } from '../../db/db.module.js';
import { advice, follows, places, tips, users } from '../../db/schema.js';
import { TipsService, author } from '../community/tips.service.js';

const placeView = (p: typeof places.$inferSelect) => ({ id: p.slug, name: p.name, kind: p.kind, countryCode: p.countryCode, summary: p.summary, bestTime: p.bestTime, currency: p.currency, imageKey: p.imageKey });

/** Places, traveller profiles, following and search. */
@Injectable()
export class DiscoverService {
  constructor(private readonly database: Database, private readonly tipsService: TipsService) {}
  private get db() { return this.database.db; }

  async places() { return (await this.db.select().from(places).where(eq(places.published, true)).orderBy(places.name)).map(placeView); }

  async place(slug: string, viewerId?: string) {
    const [p] = await this.db.select().from(places).where(and(eq(places.slug, slug), eq(places.published, true)));
    if (!p) throw notFound('Place');
    const tipList = await this.tipsService.list({ feed: 'popular', search: p.name, limit: 12 }, viewerId);
    const [a] = await this.db.select({ n: sql<number>`count(*)::int` }).from(advice).where(and(eq(advice.countryCode, p.countryCode), eq(advice.status, 'verified')));
    return { ...placeView(p), tips: tipList, verifiedAdvice: a?.n ?? 0 };
  }

  async profile(userId: string, viewerId?: string) {
    const base = await this.tipsService.profile(userId);
    const [f] = await this.db.select({ followers: sql<number>`count(*) FILTER (WHERE ${follows.followeeId} = ${userId})::int`, following: sql<number>`count(*) FILTER (WHERE ${follows.followerId} = ${userId})::int` }).from(follows).where(or(eq(follows.followeeId, userId), eq(follows.followerId, userId)));
    const mine = viewerId ? await this.db.select({ id: follows.followeeId }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId))) : [];
    return { ...base, followers: f?.followers ?? 0, following: f?.following ?? 0, followedByMe: mine.length > 0, isMe: viewerId === userId };
  }

  async toggleFollow(followerId: string, followeeId: string) {
    if (followerId === followeeId) throw badRequest('not_yourself', 'You cannot follow yourself.');
    const [target] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, followeeId));
    if (!target) throw notFound('Traveller');
    const removed = await this.db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).returning({ id: follows.followeeId });
    if (!removed.length) {
      await this.db.insert(follows).values({ followerId, followeeId });
      const [me] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, followerId));
      await notify(this.db, followeeId, 'community', `${me?.name ?? 'A traveller'} started following you`, `/traveller/${followerId}`);
    }
    return { following: !removed.length };
  }

  /** Tips from the people the reader follows, newest first. */
  async followingFeed(viewerId: string) {
    const ids = (await this.db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId))).map((r) => r.id);
    if (!ids.length) return [];
    const rows = await this.db.select({ id: tips.id }).from(tips).where(and(inArray(tips.userId, ids), eq(tips.status, 'published'))).orderBy(desc(tips.createdAt)).limit(30);
    return Promise.all(rows.map((r) => this.tipsService.get(r.id, viewerId)));
  }

  async search(q: string, viewerId?: string) {
    const term = q.trim();
    if (term.length < 2) return { places: [], tips: [], travellers: [], advice: [] };
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const [placeRows, tipRows, people, adviceRows] = await Promise.all([
      this.db.select().from(places).where(and(eq(places.published, true), ilike(places.name, like))).limit(5),
      this.tipsService.list({ feed: 'popular', search: term, limit: 10 }, viewerId),
      this.db.select().from(users).where(and(eq(users.status, 'active'), sql`${users.name} IS NOT NULL`, or(ilike(users.name, like), ilike(users.handle, like)))).limit(8),
      this.db.select({ code: advice.countryCode, city: advice.city, n: sql<number>`count(*)::int` }).from(advice).where(and(eq(advice.status, 'verified'), ilike(advice.city, like))).groupBy(advice.countryCode, advice.city).limit(5),
    ]);
    const counts = people.length ? await this.db.select({ userId: tips.userId, n: sql<number>`count(*)::int` }).from(tips).where(and(inArray(tips.userId, people.map((p) => p.id)), eq(tips.status, 'published'))).groupBy(tips.userId) : [];
    return { places: placeRows.map(placeView), tips: tipRows, travellers: people.map((u) => ({ ...author(u), tips: counts.find((c) => c.userId === u.id)?.n ?? 0 })), advice: adviceRows.map((a) => ({ countryCode: a.code, city: a.city, verified: a.n })) };
  }
}
