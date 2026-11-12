import { Controller, Get, HttpCode, Inject, Injectable, Logger, Module, Param, Post, Req, UseGuards, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { sql, type SQL } from 'drizzle-orm';
import type { Request } from 'express';
import { Public } from '../../common/auth.guard.js';
import { notFound } from '../../common/errors.js';
import { notify } from '../../common/notify.js';
import { CONFIG, type Config } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { AdminAuthService, AdminGuard, CurrentAdmin, Staff, type Admin } from '../admin/admin-auth.js';
import { AdminModule } from '../admin/admin.module.js';
import { BroadcastsService } from '../admin/broadcasts.service.js';
import { CalendarModule, CalendarService } from '../calendar/calendar.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { WalletService } from '../wallet/wallet.service.js';

interface Job { name: string; label: string; what: string; everyMinutes: number; run: () => Promise<number> }
/** Trip dates and "today" are Lagos calendar days. Reminders go out from 8 am so nobody is woken by one. */
const TODAY = sql`(now() AT TIME ZONE 'Africa/Lagos')::date`;
/** Tests run at any hour, so they skip the 8 am rule. */
const DAYTIME = process.env.NODE_ENV === 'test' ? sql`TRUE` : sql`extract(hour FROM now() AT TIME ZONE 'Africa/Lagos') >= 8`;
const money = (column: SQL) => sql`'₦' || to_char(${column} / 100, 'FM999,999,999,990')`;

/**
 * Work that happens on the clock rather than when someone taps something.
 * Every job is safe to run twice and safe to run on several servers at once: a server claims a run in the
 * database before starting, and each reminder is recorded in sent_reminders before it is sent.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('Jobs');
  private timer?: NodeJS.Timeout;
  private busy = false;
  readonly jobs: Job[];
  constructor(private readonly database: Database, private readonly broadcasts: BroadcastsService, private readonly calendar: CalendarService, private readonly wallet: WalletService, @Inject(CONFIG) private readonly config: Config) {
    this.jobs = [
      { name: 'scheduled_notifications', label: 'Scheduled notifications', what: 'Sends notifications staff scheduled for later', everyMinutes: 1, run: () => this.broadcasts.deliverDue() },
      { name: 'plan_on_sale', label: 'Plans going on sale', what: 'Tells sellers when their plan opens for sale, the morning after their trip ends', everyMinutes: 10, run: () => this.plansOnSale() },
      { name: 'calendar_sync', label: 'Google Calendar sync', what: 'Retries trips that have not reached a traveller\'s Google Calendar yet', everyMinutes: 5, run: () => this.calendar.syncAll() },
      { name: 'trip_reminders', label: 'Trip reminders', what: 'Reminds travellers a week and a day before a trip, and asks for a tip when they are back', everyMinutes: 30, run: () => this.tripReminders() },
      { name: 'auto_save', label: 'Automatic savings', what: 'Moves each goal\'s daily, weekly or monthly amount from the wallet balance into the goal', everyMinutes: 60, run: () => this.autoSave() },
      { name: 'goal_reminders', label: 'Savings goal reminders', what: 'Reminds travellers a week before a goal\'s target date if it is not full yet', everyMinutes: 60, run: () => this.goalReminders() },
      { name: 'cleanup', label: 'Housekeeping', what: 'Deletes expired sign-in codes and old sessions', everyMinutes: 360, run: () => this.cleanup() },
    ];
  }
  private get db() { return this.database.db; }

  onApplicationBootstrap() {
    if (this.config.NODE_ENV === 'test' || this.config.JOBS_ENABLED === '0') return;
    this.timer = setInterval(() => void this.runDue(), 30_000);
    this.timer.unref();
    this.log.log(`Timed jobs are on: ${this.jobs.map((j) => j.name).join(', ')}`);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Runs every job whose time has come. Called twice a minute. */
  async runDue() {
    if (this.busy) return;
    this.busy = true;
    try { for (const job of this.jobs) await this.run(job.name, false); }
    catch (e) { this.log.error(`Could not check timed jobs: ${(e as Error).message}`); }
    finally { this.busy = false; }
  }

  /**
   * Runs one job. Unless forced, it first claims the run: the update only succeeds when the job has not run
   * within its interval, so two servers checking at the same moment cannot both run it.
   */
  async run(name: string, force: boolean) {
    const job = this.jobs.find((j) => j.name === name);
    if (!job) throw notFound('Timed job');
    const claimed = await this.db.execute(sql`INSERT INTO job_runs (name, last_run_at) VALUES (${name}, now())
      ON CONFLICT (name) DO UPDATE SET last_run_at = now() WHERE ${force} OR job_runs.last_run_at <= now() - make_interval(secs => ${job.everyMinutes * 60 - 5}) RETURNING name`);
    if (!claimed.rowCount) return { ran: false as const };
    const started = Date.now();
    try {
      const did = await job.run();
      await this.db.execute(sql`UPDATE job_runs SET last_ok_at = now(), last_error = NULL, last_ms = ${Date.now() - started}, last_did = ${did} WHERE name = ${name}`);
      if (did) this.log.log(`${name}: ${did}`);
      return { ran: true as const, did };
    } catch (e) {
      const message = (e as Error).message.slice(0, 300);
      await this.db.execute(sql`UPDATE job_runs SET last_error = ${message}, last_ms = ${Date.now() - started} WHERE name = ${name}`);
      this.log.error(`${name} failed: ${message}`);
      return { ran: true as const, did: 0, error: message };
    }
  }

  /** For the console: each job, how often it runs, and how its last run went. */
  async status() {
    const rows = (await this.db.execute(sql`SELECT name, last_run_at, last_ok_at, last_error, last_did FROM job_runs`)).rows as { name: string; last_run_at: Date; last_ok_at: Date | null; last_error: string | null; last_did: number }[];
    return { running: this.config.JOBS_ENABLED !== '0', jobs: this.jobs.map((j) => { const r = rows.find((x) => x.name === j.name);
      return { name: j.name, label: j.label, what: j.what, everyMinutes: j.everyMinutes, lastRunAt: r?.last_run_at ?? null, lastOkAt: r?.last_ok_at ?? null, lastDid: r?.last_did ?? 0, problem: r?.last_error ?? null }; }) };
  }

  // ───────────── The jobs ─────────────

  /** Inserts a notification for each row of `due` (user_id, key, text, href) that has not had this reminder before. */
  private async remind(due: SQL, type: 'trips' | 'wallet' | 'community') {
    const r = await this.db.execute(sql`WITH due AS (${due}),
      fresh AS (INSERT INTO sent_reminders (key) SELECT key FROM due ON CONFLICT DO NOTHING RETURNING key)
      INSERT INTO notifications (user_id, type, text, href) SELECT d.user_id, ${type}, d.text, d.href FROM due d JOIN fresh f ON f.key = d.key`);
    return r.rowCount ?? 0;
  }

  private async tripReminders() {
    const trip = (when: SQL, tag: string, text: SQL) => sql`SELECT t.user_id, 'trip:' || t.id || ${`:${tag}`} AS key, ${text} AS text, '/trip/' || t.id AS href FROM trips t JOIN users u ON u.id = t.user_id AND u.status = 'active' WHERE ${when} AND ${DAYTIME}`;
    return this.remind(sql`${trip(sql`t.start_date = ${TODAY} + 7`, 'week', sql`'One week to go: ' || t.title || ' starts on ' || to_char(t.start_date, 'FMDay FMDD FMMonth') || '. Check your itinerary and what to pack.'`)}
      UNION ALL ${trip(sql`t.start_date = ${TODAY} + 1`, 'day', sql`t.title || ' starts tomorrow. Have a great trip to ' || t.place || '!'`)}
      UNION ALL ${trip(sql`t.end_date = ${TODAY} - 1`, 'back', sql`'Welcome back from ' || t.place || '. Share a tip while it is fresh, so the next traveller has it easier.'`)}`, 'trips');
  }

  /** A paid plan opens at 6:00 am Lagos time the day after the trip ends. Only plans that opened in the last two days are announced. */
  private async plansOnSale() {
    const opens = sql`((t.end_date + 1)::timestamp + interval '6 hours') AT TIME ZONE 'Africa/Lagos'`;
    return this.remind(sql`SELECT p.user_id, 'plan:' || p.id || ':on_sale' AS key, 'Your plan "' || t.title || '" is now on sale for ' || ${money(sql`p.price`)} || '. Share it to get your first buyers.' AS text, '/creator-studio' AS href
      FROM plans p JOIN trips t ON t.id = p.trip_id WHERE p.mode = 'sell' AND p.removed_at IS NULL AND ${opens} <= now() AND ${opens} > now() - interval '2 days'`, 'community');
  }

  private async goalReminders() {
    return this.remind(sql`SELECT g.user_id, 'goal:' || g.id || ':week' AS key, 'One week left for ' || g.name || '. You have saved ' || ${money(sql`a.balance`)} || ' of ' || ${money(sql`g.target`)} || '.' AS text, '/wallet/goal/' || g.id AS href
      FROM savings_goals g JOIN ledger_accounts a ON a.id = g.account_id WHERE g.closed_at IS NULL AND g.target_date = ${TODAY} + 7 AND a.balance < g.target AND ${DAYTIME}`, 'wallet');
  }

  /**
   * Moves each goal's set amount from the traveller's balance into the goal: daily, weekly on the weekday the goal was made,
   * or monthly on the day of the month it was made (the last day in shorter months). It never overdraws: with too little in the
   * balance, the traveller gets a nudge instead. A goal that is already full is left alone.
   */
  private async autoSave() {
    const made = sql`(g.created_at AT TIME ZONE 'Africa/Lagos')::date`;
    const due = (await this.db.execute(sql`SELECT g.id, g.user_id, g.name, LEAST(g.auto_save_amount, g.target - a.balance)::float8 AS amount, to_char(${TODAY}, 'YYYY-MM-DD') AS today,
        (SELECT balance FROM ledger_accounts v WHERE v.user_id = g.user_id AND v.kind = 'user_available')::float8 AS available
      FROM savings_goals g JOIN ledger_accounts a ON a.id = g.account_id JOIN users u ON u.id = g.user_id AND u.status = 'active' AND NOT u.wallet_frozen
      WHERE g.closed_at IS NULL AND g.auto_save_amount > 0 AND a.balance < g.target AND ${made} < ${TODAY} AND ${DAYTIME} AND (
        g.auto_save_frequency = 'daily'
        OR (g.auto_save_frequency = 'weekly' AND extract(dow FROM ${made}) = extract(dow FROM ${TODAY}))
        OR (g.auto_save_frequency = 'monthly' AND extract(day FROM ${TODAY}) = LEAST(extract(day FROM ${made}), extract(day FROM date_trunc('month', ${TODAY}) + interval '1 month - 1 day'))))
        AND NOT EXISTS (SELECT 1 FROM sent_reminders r WHERE r.key = 'autosave:' || g.id || ':' || to_char(${TODAY}, 'YYYY-MM-DD'))`)).rows as { id: string; user_id: string; name: string; amount: number; available: number | null; today: string }[];
    let moved = 0;
    for (const g of due) {
      const key = `autosave:${g.id}:${g.today}`;
      const fresh = await this.db.execute(sql`INSERT INTO sent_reminders (key) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING key`);
      if (!fresh.rowCount) continue; // another server took this one
      const amount = Math.round(g.amount); const naira = `₦${(amount / 100).toLocaleString('en-NG')}`;
      if ((g.available ?? 0) >= amount && amount >= 100_00) {
        try { await this.wallet.moveToGoal(g.user_id, g.id, amount, 'in', key); await notify(this.db, g.user_id, 'wallet', `${naira} moved into ${g.name}, as you planned.`, `/wallet/goal/${g.id}`); moved++; continue; }
        catch (e) { this.log.warn(`Auto-save for goal ${g.id} failed: ${(e as Error).message}`); }
      }
      await notify(this.db, g.user_id, 'wallet', `Your ${naira} for ${g.name} is due today, but your wallet balance is too low. Add money to stay on track.`, '/wallet/add-money');
    }
    return moved;
  }

  private async cleanup() {
    let n = 0;
    for (const q of [sql`DELETE FROM otp_codes WHERE expires_at < now() - interval '1 day'`, sql`DELETE FROM login_handoffs WHERE expires_at < now() - interval '1 day'`,
      sql`DELETE FROM sessions WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'`, sql`DELETE FROM admin_sessions WHERE expires_at < now() - interval '30 days'`,
      sql`DELETE FROM sent_reminders WHERE created_at < now() - interval '180 days'`]) n += (await this.db.execute(q)).rowCount ?? 0;
    return n;
  }
}

@ApiTags('admin') @ApiBearerAuth()
@Public() @UseGuards(AdminGuard)
@Controller('admin/jobs')
class JobsController {
  constructor(private readonly jobs: JobsService, private readonly auth: AdminAuthService) {}
  @Staff('settings') @Get() status() { return this.jobs.status(); }
  /** Runs a job now instead of waiting for its turn. Useful after fixing whatever made it fail. */
  @Staff('settings', 'edit') @HttpCode(200) @Post(':name/run')
  async run(@CurrentAdmin() admin: Admin, @Param('name') name: string, @Req() req: Request) {
    const r = await this.jobs.run(name, true);
    await this.auth.record(admin, 'Ran timed job', name, req);
    return { ...r, ...(await this.jobs.status()) };
  }
}

@Module({ imports: [AdminModule, CalendarModule, WalletModule], controllers: [JobsController], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
