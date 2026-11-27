import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentUser, MaybeUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { badRequest, forbidden, notFound } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { Database } from '../../db/db.module.js';
import { momentComments, momentLikes, moments, users } from '../../db/schema.js';
import { author } from '../community/tips.service.js';
import { MediaService } from '../media/media.service.js';

/**
 * Moments are the public timeline on Explore: a status, an event, trip talk, a safety alert or something fun.
 * There is no following. Every published moment is shown to everyone, newest first, and anyone signed in can like or comment.
 */
export const KINDS = ['status', 'event', 'trip', 'safety', 'fun'] as const;
export type MomentKind = (typeof KINDS)[number];
const LABEL: Record<MomentKind, string> = { status: 'status', event: 'event', trip: 'trip talk', safety: 'safety alert', fun: 'moment' };
const PAGE = 20;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
export const momentBody = z.object({
  kind: z.enum(KINDS),
  body: z.string().trim().max(500, 'Keep it under 500 characters'),
  mediaId: z.uuid().optional(),
  place: z.string().trim().min(2).max(80).optional(),
  countryCode: z.string().length(2).optional(),
  eventDate: day.optional(),
});
const commentBody = z.object({ body: z.string().trim().min(1, 'Write a comment').max(500) });

const excerpt = (s: string, n = 50) => (s.length > n ? `${s.slice(0, n)}…` : s);

@Injectable()
export class MomentsService {
  constructor(private readonly database: Database, private readonly media: MediaService) {}
  private get db() { return this.database.db; }

  private async view(rows: { m: typeof moments.$inferSelect; u: typeof users.$inferSelect }[], viewerId?: string) {
    const ids = rows.map((r) => r.m.id);
    const liked = viewerId && ids.length ? new Set((await this.db.select({ id: momentLikes.momentId }).from(momentLikes).where(and(eq(momentLikes.userId, viewerId), inArray(momentLikes.momentId, ids)))).map((l) => l.id)) : new Set<string>();
    const files = await this.media.views(rows.map((r) => r.m.mediaId).filter((x): x is string => !!x));
    return rows.map(({ m, u }) => ({
      id: m.id, kind: m.kind, body: m.body, media: (m.mediaId && files.get(m.mediaId)) || null, place: m.place, countryCode: m.countryCode, eventDate: m.eventDate,
      likes: m.likeCount, comments: m.commentCount, createdAt: m.createdAt, author: author(u), liked: liked.has(m.id), mine: m.userId === viewerId,
    }));
  }

  /** Newest first. Pass the `next` value from one page as `before` to get the page after it. */
  async list(q: { kind?: MomentKind; authorId?: string; before?: Date }, viewerId?: string) {
    const rows = await this.db.select({ m: moments, u: users }).from(moments).innerJoin(users, eq(users.id, moments.userId))
      .where(and(eq(moments.status, 'published'), eq(users.status, 'active'), q.kind ? eq(moments.kind, q.kind) : undefined, q.authorId ? eq(moments.userId, q.authorId) : undefined, q.before ? lt(moments.createdAt, q.before) : undefined))
      .orderBy(desc(moments.createdAt)).limit(PAGE + 1);
    const items = await this.view(rows.slice(0, PAGE), viewerId);
    return { items, next: rows.length > PAGE ? items[items.length - 1]!.createdAt.toISOString() : null };
  }

  async get(id: string, viewerId?: string) {
    const rows = await this.db.select({ m: moments, u: users }).from(moments).innerJoin(users, eq(users.id, moments.userId)).where(and(eq(moments.id, id), eq(moments.status, 'published')));
    if (!rows.length) throw notFound('That moment');
    return (await this.view(rows, viewerId))[0]!;
  }

  async create(userId: string, input: z.infer<typeof momentBody>) {
    const file = input.mediaId ? await this.media.owned(userId, input.mediaId) : null;
    if (input.mediaId && !file) throw notFound('That upload');
    if (!file && input.body.length < 2) throw badRequest('empty_moment', 'Write something, or add a photo, video or voice note.');
    if (input.kind === 'event' && !input.eventDate) throw badRequest('event_date_required', 'Choose the day of the event.');
    if (input.kind === 'safety' && !input.place) throw badRequest('place_required', 'Say where this is, so travellers nearby can see it.');
    const [m] = await this.db.insert(moments).values({ userId, kind: input.kind, body: input.body, mediaId: file?.id, place: input.place, countryCode: input.countryCode?.toUpperCase(), eventDate: input.kind === 'event' ? input.eventDate : null }).returning({ id: moments.id });
    return this.get(m!.id, userId);
  }

  /** Authors can take down their own moment. It disappears for everyone, along with its likes and comments. */
  async remove(userId: string, id: string) {
    const [m] = await this.db.update(moments).set({ status: 'removed' }).where(and(eq(moments.id, id), eq(moments.userId, userId), eq(moments.status, 'published'))).returning({ id: moments.id });
    if (!m) throw notFound('That moment');
  }

  /** Likes or unlikes. The count changes in the same transaction as the like, so it cannot drift. */
  async toggleLike(userId: string, id: string) {
    await this.get(id);
    return this.db.transaction(async (tx) => {
      const removed = await tx.delete(momentLikes).where(and(eq(momentLikes.momentId, id), eq(momentLikes.userId, userId))).returning({ id: momentLikes.momentId });
      if (!removed.length) await tx.insert(momentLikes).values({ momentId: id, userId });
      const [m] = await tx.update(moments).set({ likeCount: sql`GREATEST(${moments.likeCount} + ${removed.length ? -1 : 1}, 0)` }).where(eq(moments.id, id)).returning({ likes: moments.likeCount });
      return { liked: !removed.length, likes: m!.likes };
    });
  }

  async comments(id: string, viewerId?: string) {
    const m = await this.get(id);
    const rows = await this.db.select({ c: momentComments, u: users }).from(momentComments).innerJoin(users, eq(users.id, momentComments.userId))
      .where(and(eq(momentComments.momentId, id), eq(momentComments.status, 'published'))).orderBy(momentComments.createdAt).limit(300);
    return rows.map(({ c, u }) => ({ id: c.id, body: c.body, createdAt: c.createdAt, author: author(u), isAuthor: c.userId === m.author.id, mine: c.userId === viewerId }));
  }

  async addComment(userId: string, id: string, body: string) {
    const m = await this.get(id);
    const [me] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    await this.db.transaction(async (tx) => {
      await tx.insert(momentComments).values({ momentId: id, userId, body });
      await tx.update(moments).set({ commentCount: sql`${moments.commentCount} + 1` }).where(eq(moments.id, id));
      const about = m.body ? ` "${excerpt(m.body)}"` : '';
      if (m.author.id !== userId) await notify(tx, m.author.id, 'community', `${me?.name ?? 'A traveller'} commented on your ${LABEL[m.kind]}${about}`, `/moment/${id}`);
    });
    return this.comments(id, userId);
  }

  /** The commenter, or the moment's author, can remove a comment. */
  async removeComment(userId: string, id: string, commentId: string) {
    const m = await this.get(id);
    const [c] = await this.db.select().from(momentComments).where(and(eq(momentComments.id, commentId), eq(momentComments.momentId, id), eq(momentComments.status, 'published')));
    if (!c) throw notFound('That comment');
    if (c.userId !== userId && m.author.id !== userId) throw forbidden('not_yours', 'You can only remove your own comments, or comments on your own moment.');
    await this.db.transaction(async (tx) => {
      await tx.update(momentComments).set({ status: 'removed' }).where(eq(momentComments.id, commentId));
      await tx.update(moments).set({ commentCount: sql`GREATEST(${moments.commentCount} - 1, 0)` }).where(eq(moments.id, id));
    });
    return this.comments(id, userId);
  }
}

@ApiTags('moments')
@Controller('moments')
export class MomentsController {
  constructor(private readonly moments: MomentsService) {}

  // Reading is open to guests; a token adds "liked by me" and "mine".
  @Public() @Get()
  list(@MaybeUser() u: AuthUser | undefined, @Query('kind') kind?: string, @Query('authorId') authorId?: string, @Query('before') before?: string) {
    const at = before ? new Date(before) : undefined;
    return this.moments.list({ kind: z.enum(KINDS).safeParse(kind).data, authorId: z.uuid().safeParse(authorId).data, before: at && !Number.isNaN(at.getTime()) ? at : undefined }, u?.id);
  }
  @Public() @Get(':id') one(@MaybeUser() u: AuthUser | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.moments.get(id, u?.id); }
  @Public() @Get(':id/comments') comments(@MaybeUser() u: AuthUser | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.moments.comments(id, u?.id); }

  @ApiBearerAuth() @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post() create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(momentBody)) b: z.infer<typeof momentBody>) { return this.moments.create(u.id, b); }
  @ApiBearerAuth() @HttpCode(204)
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.moments.remove(u.id, id); }
  @ApiBearerAuth() @HttpCode(200)
  @Post(':id/like') like(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.moments.toggleLike(u.id, id); }
  @ApiBearerAuth() @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/comments') comment(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(commentBody)) b: z.infer<typeof commentBody>) { return this.moments.addComment(u.id, id, b.body); }
  @ApiBearerAuth()
  @Delete(':id/comments/:commentId') uncomment(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) { return this.moments.removeComment(u.id, id, commentId); }
}

@Module({ controllers: [MomentsController], providers: [MomentsService], exports: [MomentsService] })
export class MomentsModule {}
