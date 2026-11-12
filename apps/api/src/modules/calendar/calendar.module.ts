import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Logger, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { and, eq, sql } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard.js';
import { badRequest, notFound } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { CONFIG, type Config } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { calendarLinks, itineraryItems, trips } from '../../db/schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { GoogleApi, type GoogleTokens } from '../auth/google.js';
import { SocialAuthService } from '../auth/social.service.js';

const CALENDAR_NAME = 'EveryCation trips';
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const niceDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Copies a traveller's trips into a calendar called "EveryCation trips" in their Google Calendar.
 * One way only: the app is where trips are edited. We ask Google for access to calendars this app creates and nothing else.
 */
@Injectable()
export class CalendarService {
  private readonly log = new Logger('Calendar');
  private readonly key: Buffer;
  constructor(private readonly database: Database, private readonly google: GoogleApi, private readonly social: SocialAuthService, @Inject(CONFIG) config: Config) {
    this.key = createHash('sha256').update(`calendar-tokens:${config.JWT_SECRET}`).digest();
    social.onCalendarGrant = (userId, tokens) => this.connected(userId, tokens);
  }
  private get db() { return this.database.db; }

  // Google's long-lived token lets us write to the calendar at any time, so it is never stored in the clear.
  private seal(text: string) { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', this.key, iv); const body = Buffer.concat([c.update(text, 'utf8'), c.final()]); return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.'); }
  private open(sealed: string) { const [iv, tag, body] = sealed.split('.').map((s) => Buffer.from(s, 'base64url')); const d = createDecipheriv('aes-256-gcm', this.key, iv!); d.setAuthTag(tag!); return Buffer.concat([d.update(body!), d.final()]).toString('utf8'); }

  async status(userId: string) {
    const [link] = await this.db.select().from(calendarLinks).where(eq(calendarLinks.userId, userId));
    const [w] = await this.db.select({ n: sql<number>`count(*)::int` }).from(trips).where(and(eq(trips.userId, userId), eq(trips.calendarDirty, true)));
    return { available: this.google.enabled, connected: !!link, account: link?.accountEmail ?? null, calendar: link ? CALENDAR_NAME : null, lastSyncedAt: link?.lastSyncedAt ?? null, problem: link?.lastError ?? null, waiting: link ? w?.n ?? 0 : 0 };
  }

  /** The Google page where the traveller agrees to the connection. They come back to `returnTo` in the app. */
  async connectUrl(userId: string, returnTo: string) { return { url: await this.social.startUrl('calendar', returnTo, userId) }; }

  /** Called when Google sends the traveller back having agreed. */
  private async connected(userId: string, tokens: GoogleTokens) {
    if (!tokens.refreshToken) throw badRequest('google_failed', 'Google did not give lasting access. Please try connecting again.');
    const [old] = await this.db.select().from(calendarLinks).where(eq(calendarLinks.userId, userId));
    // Reconnecting the same Google account keeps the calendar it already has; a different account starts a fresh one.
    const keep = old && old.accountEmail === tokens.email;
    const calendarId = keep ? old.calendarId : await this.google.createCalendar(tokens.accessToken, CALENDAR_NAME);
    const row = { accountEmail: tokens.email, refreshToken: this.seal(tokens.refreshToken), calendarId, lastError: null };
    await this.db.insert(calendarLinks).values({ userId, ...row }).onConflictDoUpdate({ target: calendarLinks.userId, set: row });
    await this.db.update(trips).set({ calendarDirty: true, ...(keep ? {} : { calendarEventId: null }) }).where(eq(trips.userId, userId));
    await this.sync(userId);
  }

  /** Stops syncing and forgets the connection. Events already in Google Calendar stay there for the traveller to keep or delete. */
  async disconnect(userId: string) {
    const [link] = await this.db.delete(calendarLinks).where(eq(calendarLinks.userId, userId)).returning();
    if (!link) throw notFound('Calendar connection');
    await this.db.update(trips).set({ calendarEventId: null, calendarDirty: true }).where(eq(trips.userId, userId));
    try { await this.google.revoke(this.open(link.refreshToken)); } catch { /* already revoked on Google's side */ }
    return this.status(userId);
  }

  /** Trips call this after a change. It does not make the traveller wait and never fails their request; the timed job retries anything missed. */
  changed(userId: string) { void this.sync(userId).catch((e) => this.log.warn(`Sync for ${userId} failed: ${(e as Error).message}`)); }

  /** Writes every changed trip to the traveller's calendar. Returns how many were written. */
  async sync(userId: string): Promise<number> {
    const [link] = await this.db.select().from(calendarLinks).where(eq(calendarLinks.userId, userId));
    if (!link || !this.google.enabled) return 0;
    const waiting = await this.db.select().from(trips).where(and(eq(trips.userId, userId), eq(trips.calendarDirty, true))).limit(50);
    if (!waiting.length) return 0;
    let done = 0;
    try {
      const access = await this.google.accessToken(this.open(link.refreshToken));
      for (const t of waiting) {
        const items = await this.db.select().from(itineraryItems).where(eq(itineraryItems.tripId, t.id)).orderBy(itineraryItems.day, itineraryItems.time);
        const description = [...items.map((i) => `${niceDay(i.day)} ${i.time}  ${i.title}${i.note ? ` (${i.note})` : ''}`), items.length ? '' : null, 'Planned in EveryCation. Edit this trip in the app.'].filter((l) => l !== null).join('\n');
        const eventId = await this.google.saveEvent(access, link.calendarId, t.calendarEventId, { summary: t.title, location: t.place, description, startDate: t.startDate, endDateExclusive: nextDay(t.endDate) });
        await this.db.update(trips).set({ calendarEventId: eventId, calendarDirty: false }).where(eq(trips.id, t.id));
        done++;
      }
      await this.db.update(calendarLinks).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(calendarLinks.userId, userId));
    } catch (e) {
      const status = (e as { status?: number }).status;
      // 400 or 401 from Google means the traveller removed our access; anything else is usually temporary.
      const problem = status === 400 || status === 401 ? 'Google Calendar access was removed. Connect again to keep your trips in sync.' : status === 404 ? 'The EveryCation calendar was deleted in Google. Disconnect and connect again to make a new one.' : 'Google Calendar could not be reached. We will try again shortly.';
      await this.db.update(calendarLinks).set({ lastError: problem }).where(eq(calendarLinks.userId, userId));
      this.log.warn(`Sync for ${userId} stopped: ${(e as Error).message}`);
    }
    return done;
  }

  /** The timed job: everyone with a connection and something waiting. Connections that need the traveller to reconnect are skipped. */
  async syncAll(): Promise<number> {
    const r = await this.db.execute(sql`SELECT DISTINCT l.user_id FROM calendar_links l JOIN trips t ON t.user_id = l.user_id AND t.calendar_dirty WHERE l.last_error IS NULL OR l.last_error LIKE '%try again%' LIMIT 200`);
    let done = 0;
    for (const row of r.rows as { user_id: string }[]) done += await this.sync(row.user_id);
    return done;
  }
}

const connectBody = z.object({ returnTo: z.string().min(4).max(300) });

@ApiTags('calendar') @ApiBearerAuth()
@Controller('calendar')
class CalendarController {
  constructor(private readonly calendar: CalendarService) {}
  @Get() status(@CurrentUser() u: AuthUser) { return this.calendar.status(u.id); }
  @Post('google/connect') @HttpCode(200) connect(@CurrentUser() u: AuthUser, @Body(new ZodPipe(connectBody)) b: z.infer<typeof connectBody>) { return this.calendar.connectUrl(u.id, b.returnTo); }
  @Post('sync') @HttpCode(200) async sync(@CurrentUser() u: AuthUser) { await this.calendar.sync(u.id); return this.calendar.status(u.id); }
  @Delete('google') disconnect(@CurrentUser() u: AuthUser) { return this.calendar.disconnect(u.id); }
}

@Module({ imports: [AuthModule], controllers: [CalendarController], providers: [CalendarService], exports: [CalendarService] })
export class CalendarModule {}
