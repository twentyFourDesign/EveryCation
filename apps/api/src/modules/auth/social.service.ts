import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { badRequest, forbidden, notFound } from '../../common/errors.js';
import { CONFIG, type Config } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { loginHandoffs, users } from '../../db/schema.js';
import { AuthService } from './auth.service.js';
import { AppleVerifier, CALENDAR_SCOPES, GoogleApi, SIGN_IN_SCOPES, type GoogleTokens } from './google.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** What rides along with the trip to Google and back, signed so it cannot be changed on the way. */
interface State { purpose: 'sign_in' | 'calendar'; returnTo: string; userId?: string }
const withParams = (url: string, params: Record<string, string>) => { const u = new URL(url); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); };

/** Sign in with Google (through the browser, so one setup covers iPhone, Android and web) and with Apple (on iPhone). */
@Injectable()
export class SocialAuthService {
  /** Set by the calendar module, so finishing a "connect calendar" trip to Google lands there without auth depending on it. */
  onCalendarGrant: (userId: string, tokens: GoogleTokens) => Promise<void> = async () => { throw notFound('Calendar sync'); };
  constructor(private readonly database: Database, private readonly auth: AuthService, private readonly jwt: JwtService, private readonly google: GoogleApi, private readonly apple: AppleVerifier, @Inject(CONFIG) private readonly config: Config) {}
  private get db() { return this.database.db; }

  providers() { return { google: this.google.enabled, apple: this.apple.enabled, calendar: this.google.enabled }; }

  /** Only the app's own addresses may receive someone after sign-in; anything else could be a site trying to catch the code. */
  private checkReturn(returnTo: string) {
    const allowed = ['everycation://', ...this.config.APP_RETURN_URLS.split(',').map((s) => s.trim()).filter(Boolean), ...(this.config.NODE_ENV === 'production' ? [] : ['http://localhost:', 'exp://'])];
    if (!allowed.some((p) => returnTo.startsWith(p))) throw badRequest('bad_return', 'That return address is not allowed.');
    return returnTo;
  }
  async startUrl(purpose: State['purpose'], returnTo: string, userId?: string) {
    if (!this.google.enabled) throw notFound('Google sign-in');
    const state = await this.jwt.signAsync({ purpose, returnTo: this.checkReturn(returnTo), userId } satisfies State, { expiresIn: '10m', audience: 'google-state' });
    return this.google.consentUrl(state, purpose === 'calendar' ? CALENDAR_SCOPES : SIGN_IN_SCOPES, purpose === 'calendar');
  }

  /** Google sends the browser back here. Returns the address to send the person on to: back into the app, with a one-time code or an error. */
  async callback(q: { code?: string; state?: string; error?: string }) {
    let state: State;
    try { state = await this.jwt.verifyAsync<State>(q.state ?? '', { audience: 'google-state' }); } catch { throw badRequest('bad_state', 'That sign-in link has expired. Go back to the app and try again.'); }
    const back = (params: Record<string, string>) => withParams(state.returnTo, params);
    if (q.error || !q.code) return back({ error: q.error === 'access_denied' ? 'cancelled' : 'google_failed' });
    try {
      const tokens = await this.google.exchangeCode(q.code);
      if (state.purpose === 'calendar') { await this.onCalendarGrant(state.userId!, tokens); return back({ calendar: 'connected' }); }
      const user = await this.findOrCreate('google', tokens.sub, tokens.email, tokens.emailVerified, tokens.name);
      const code = randomBytes(32).toString('base64url');
      await this.db.insert(loginHandoffs).values({ codeHash: sha256(code), userId: user.id, expiresAt: new Date(Date.now() + 120_000) });
      return back({ code });
    } catch (e) { return back({ error: (e as { code?: string }).code ?? 'google_failed' }); }
  }

  /** The app swaps the one-time code for a session. A code works once, for two minutes. */
  async redeem(code: string, device?: string) {
    const [h] = await this.db.update(loginHandoffs).set({ usedAt: new Date() }).where(and(eq(loginHandoffs.codeHash, sha256(code)), isNull(loginHandoffs.usedAt), gt(loginHandoffs.expiresAt, new Date()))).returning();
    if (!h) throw badRequest('handoff_expired', 'That sign-in has expired. Please try again.');
    return this.auth.startSession(h.userId, device);
  }

  async appleSignIn(identityToken: string, name?: string, device?: string) {
    if (!this.apple.enabled) throw notFound('Sign in with Apple');
    const id = await this.apple.verify(identityToken);
    const user = await this.findOrCreate('apple', id.sub, id.email, id.emailVerified, name ?? null);
    return this.auth.startSession(user.id, device);
  }

  /**
   * The same person, however they sign in: first by their Google or Apple id, then by a confirmed email address
   * (so someone who used an email code before keeps their account), otherwise a new account.
   */
  private async findOrCreate(provider: 'google' | 'apple', sub: string, email: string | null, emailVerified: boolean, name: string | null) {
    const column = provider === 'google' ? users.googleSub : users.appleSub; const field = provider === 'google' ? 'googleSub' : 'appleSub';
    const confirmed = email && emailVerified ? email : null;
    const [found] = await this.db.select().from(users).where(confirmed ? or(eq(column, sub), eq(users.email, confirmed)) : eq(column, sub)).orderBy(column).limit(1);
    if (found) {
      if (found.status !== 'active') throw forbidden('account_suspended', 'This account is suspended. Contact support.');
      if (found[field] && found[field] !== sub) throw badRequest('email_in_use', `That email already belongs to an account that signs in with a different ${provider === 'google' ? 'Google' : 'Apple'} account.`);
      if (!found[field] || (!found.name && name)) await this.db.update(users).set({ [field]: sub, name: found.name ?? name?.slice(0, 60) ?? null }).where(eq(users.id, found.id));
      return found;
    }
    const [made] = await this.db.insert(users).values({ [field]: sub, email: confirmed, name: name?.slice(0, 60) ?? null }).returning();
    return made!;
  }
}
