import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import { badRequest } from '../../common/errors.js';
import { CONFIG, type Config } from '../../config.js';

export interface GoogleTokens { sub: string; email: string | null; emailVerified: boolean; name: string | null; refreshToken: string | null; accessToken: string }
export interface CalendarEvent { summary: string; location: string; description: string; startDate: string; endDateExclusive: string }
export const SIGN_IN_SCOPES = 'openid email profile';
export const CALENDAR_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.app.created';

/** Every call this API makes to Google. Tests replace these methods, so nothing else in the code talks to Google. */
@Injectable()
export class GoogleApi {
  constructor(@Inject(CONFIG) private readonly config: Config) {}
  get enabled() { return !!this.config.GOOGLE_CLIENT_ID && !!this.config.GOOGLE_CLIENT_SECRET; }
  get redirectUri() { return `${(this.config.PUBLIC_URL ?? `http://localhost:${this.config.PORT}`).replace(/\/$/, '')}/v1/auth/google/callback`; }

  consentUrl(state: string, scopes: string, offline: boolean) {
    const q = new URLSearchParams({ client_id: this.config.GOOGLE_CLIENT_ID ?? '', redirect_uri: this.redirectUri, response_type: 'code', scope: scopes, state, ...(offline ? { access_type: 'offline', prompt: 'consent' } : { prompt: 'select_account' }) });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  private async call<T>(url: string, init: RequestInit, what: string): Promise<T> {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw Object.assign(new Error(`Google ${what} failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`), { status: res.status });
    return data as T;
  }
  private token(body: Record<string, string>) {
    return this.call<{ access_token: string; refresh_token?: string; id_token?: string }>('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.config.GOOGLE_CLIENT_ID ?? '', client_secret: this.config.GOOGLE_CLIENT_SECRET ?? '', ...body }) }, 'sign-in');
  }

  /** Swaps the code Google sent back for the person's identity and tokens. The reply comes straight from Google over TLS, so its ID token is trusted. */
  async exchangeCode(code: string): Promise<GoogleTokens> {
    const t = await this.token({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri });
    if (!t.id_token) throw badRequest('google_failed', 'Google did not confirm who you are. Please try again.');
    const c = decodeJwt(t.id_token);
    if (c.aud !== this.config.GOOGLE_CLIENT_ID || !['https://accounts.google.com', 'accounts.google.com'].includes(String(c.iss)) || !c.sub) throw badRequest('google_failed', 'Google did not confirm who you are. Please try again.');
    return { sub: c.sub, email: typeof c.email === 'string' ? c.email.toLowerCase() : null, emailVerified: c.email_verified === true, name: typeof c.name === 'string' ? c.name : null, refreshToken: t.refresh_token ?? null, accessToken: t.access_token };
  }
  async accessToken(refreshToken: string) { return (await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token; }
  async revoke(refreshToken: string) { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST', signal: AbortSignal.timeout(10_000) }).catch(() => undefined); }

  private cal<T>(accessToken: string, path: string, method: string, body?: unknown) {
    return this.call<T>(`https://www.googleapis.com/calendar/v3${path}`, { method, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, 'Calendar');
  }
  async createCalendar(accessToken: string, name: string) { return (await this.cal<{ id: string }>(accessToken, '/calendars', 'POST', { summary: name, description: 'Trips you plan in EveryCation. Edit them in the app.' })).id; }
  /** Creates the event, or updates it when it already exists. Returns the event's id. */
  async saveEvent(accessToken: string, calendarId: string, eventId: string | null, e: CalendarEvent) {
    const body = { summary: e.summary, location: e.location, description: e.description, start: { date: e.startDate }, end: { date: e.endDateExclusive }, transparency: 'transparent' };
    const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
    if (eventId) {
      try { return (await this.cal<{ id: string }>(accessToken, `${base}/${encodeURIComponent(eventId)}`, 'PUT', body)).id; }
      catch (err) { if (![404, 410].includes((err as { status?: number }).status ?? 0)) throw err; } // deleted in Google Calendar: make it again
    }
    return (await this.cal<{ id: string }>(accessToken, base, 'POST', body)).id;
  }
  async deleteEvent(accessToken: string, calendarId: string, eventId: string) {
    try { await this.cal(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, 'DELETE'); }
    catch (err) { if (![404, 410].includes((err as { status?: number }).status ?? 0)) throw err; }
  }
}

/** Checks the identity token an iPhone hands over after Sign in with Apple. */
@Injectable()
export class AppleVerifier {
  private readonly keys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  constructor(@Inject(CONFIG) private readonly config: Config) {}
  get audiences() { return (this.config.APPLE_AUDIENCES ?? '').split(',').map((s) => s.trim()).filter(Boolean); }
  get enabled() { return this.audiences.length > 0; }
  async verify(identityToken: string): Promise<{ sub: string; email: string | null; emailVerified: boolean }> {
    try {
      const { payload } = await jwtVerify(identityToken, this.keys, { issuer: 'https://appleid.apple.com', audience: this.audiences });
      return { sub: payload.sub!, email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null, emailVerified: payload.email_verified === true || payload.email_verified === 'true' };
    } catch { throw badRequest('apple_failed', 'Apple did not confirm who you are. Please try again.'); }
  }
}
