import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { CONFIG, RULES, type Config } from '../../config.js';
import { badRequest, tooMany, unauthorized } from '../../common/errors.js';
import { Database } from '../../db/db.module.js';
import { otpCodes, sessions, users } from '../../db/schema.js';
import { SmsSender } from './sms.js';

const minutes = (n: number) => new Date(Date.now() + n * 60_000);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** "0803 123 4821", "803 123 4821" or "+234 803…" → "+2348031234821". */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  const local = digits.startsWith('+234') ? digits.slice(4) : digits.startsWith('234') ? digits.slice(3) : digits.replace(/^0/, '');
  if (!/^[789]\d{9}$/.test(local)) throw badRequest('invalid_phone', 'Enter a valid Nigerian mobile number, like 803 123 4821.');
  return `+234${local}`;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: Database, private readonly jwt: JwtService, private readonly sms: SmsSender, @Inject(CONFIG) private readonly config: Config) {}
  private get db() { return this.database.db; }
  private hashCode(destination: string, code: string) { return createHmac('sha256', this.config.OTP_SECRET).update(`${destination}:${code}`).digest('hex'); }

  /** Step 1: send a 6-digit code. Outside production the code is also returned so the apps can be tested without SMS. */
  async requestCode(phoneInput: string) {
    const phone = normalisePhone(phoneInput);
    const [last] = await this.db.select().from(otpCodes).where(eq(otpCodes.destination, phone)).orderBy(desc(otpCodes.createdAt)).limit(1);
    const wait = last ? RULES.otpResendSeconds - Math.floor((Date.now() - last.createdAt.getTime()) / 1000) : 0;
    if (wait > 0) throw tooMany('otp_wait', `You can ask for a new code in ${wait} seconds.`, { retryAfterSeconds: wait });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.insert(otpCodes).values({ destination: phone, codeHash: this.hashCode(phone, code), expiresAt: minutes(RULES.otpTtlMinutes) });
    await this.sms.send(phone, `${code} is your EveryCation code. It expires in ${RULES.otpTtlMinutes} minutes. Never share it.`);
    return { sentTo: phone.replace(/^(\+234\d{3})\d{3}(\d{4})$/, '$1 ••• $2'), resendInSeconds: RULES.otpResendSeconds, ...(this.config.NODE_ENV !== 'production' ? { devCode: code } : {}) };
  }

  /** Step 2: check the code, create the account on first use, and start a session. */
  async verifyCode(phoneInput: string, code: string, device?: string) {
    const phone = normalisePhone(phoneInput);
    const [otp] = await this.db.select().from(otpCodes)
      .where(and(eq(otpCodes.destination, phone), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, new Date()))).orderBy(desc(otpCodes.createdAt)).limit(1);
    if (!otp) throw badRequest('otp_expired', 'That code has expired. Ask for a new one.');
    if (otp.attempts >= RULES.otpMaxAttempts) throw tooMany('otp_locked', 'Too many wrong tries. Ask for a new code.');

    const given = Buffer.from(this.hashCode(phone, code)); const stored = Buffer.from(otp.codeHash);
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      await this.db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, otp.id));
      throw badRequest('otp_wrong', 'That code is not right. Check it and try again.');
    }
    await this.db.update(otpCodes).set({ usedAt: new Date() }).where(eq(otpCodes.id, otp.id));

    await this.db.insert(users).values({ phone }).onConflictDoNothing({ target: users.phone });
    const [user] = await this.db.select().from(users).where(eq(users.phone, phone));
    if (!user) throw unauthorized();
    return { isNewUser: !user.name, ...(await this.issueTokens(user.id, randomUUID(), device)) };
  }

  /** Swaps a refresh token for a new pair. Using an old token again means it leaked, so the whole session ends. */
  async refresh(refreshToken: string) {
    const [session] = await this.db.select().from(sessions).where(eq(sessions.tokenHash, sha256(refreshToken)));
    if (!session || session.revokedAt || session.expiresAt < new Date()) throw unauthorized();
    if (session.rotatedAt) {
      await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.familyId, session.familyId));
      throw unauthorized('session_revoked', 'For your safety you have been signed out. Please sign in again.');
    }
    await this.db.update(sessions).set({ rotatedAt: new Date() }).where(eq(sessions.id, session.id));
    return this.issueTokens(session.userId, session.familyId, session.device ?? undefined);
  }

  async logout(familyId: string) {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.familyId, familyId));
  }

  async me(userId: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!u) throw unauthorized();
    return { id: u.id, phone: u.phone, email: u.email, name: u.name, handle: u.handle, city: u.city, bio: u.bio, kycStatus: u.kycStatus, hasPin: !!u.pinHash, walletFrozen: u.walletFrozen };
  }

  async updateProfile(userId: string, patch: { name?: string; handle?: string; city?: string; bio?: string }) {
    try { await this.db.update(users).set({ ...patch, handle: patch.handle?.toLowerCase() }).where(eq(users.id, userId)); }
    catch { throw badRequest('handle_taken', 'That username is taken. Try another.'); }
    return this.me(userId);
  }

  private async issueTokens(userId: string, familyId: string, device?: string) {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({ userId, familyId, tokenHash: sha256(refreshToken), device, expiresAt: minutes(RULES.refreshTokenDays * 24 * 60) });
    const accessToken = await this.jwt.signAsync({ sub: userId, fam: familyId });
    return { accessToken, refreshToken, expiresInSeconds: RULES.accessTokenMinutes * 60 };
  }
}
