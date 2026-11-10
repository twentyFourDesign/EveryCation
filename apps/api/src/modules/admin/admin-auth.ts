import { createParamDecorator, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as argon2 from 'argon2';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { forbidden, unauthorized } from '../../common/errors.js';
import { RULES } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { admins, adminSessions, auditLog } from '../../db/schema.js';
import { newTotpSecret, totpValid } from './totp.js';

export type AdminRole = (typeof admins.$inferSelect)['role'];
export type Area = 'moderation' | 'users' | 'wallet' | 'payouts' | 'plans' | 'shop' | 'broadcasts' | 'settings';
type Level = 'view' | 'edit';
export interface Admin { id: string; email: string; name: string; role: AdminRole }

/** What each role may do. The same table is shown on the console's Admins page. */
export const PERMISSIONS: Record<Area, Partial<Record<AdminRole, Level>>> = {
  moderation: { super_admin: 'edit', moderator: 'edit', support: 'view' },
  users: { super_admin: 'edit', moderator: 'view', finance: 'view', support: 'edit' },
  wallet: { super_admin: 'edit', finance: 'edit', support: 'view' },
  payouts: { super_admin: 'edit', finance: 'edit' },
  plans: { super_admin: 'edit', moderator: 'edit', finance: 'view', support: 'view' },
  shop: { super_admin: 'edit', finance: 'view', shop_ops: 'edit', support: 'view' },
  broadcasts: { super_admin: 'edit', moderator: 'view', shop_ops: 'edit' },
  settings: { super_admin: 'edit', finance: 'view' },
};
export const can = (role: AdminRole, area: Area, level: Level) => { const has = PERMISSIONS[area][role]; return has === 'edit' || (has === 'view' && level === 'view'); };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const ACCESS = 'adminAccess';
/** Marks a staff route and the permission it needs: `@Staff('wallet', 'edit')`. */
export const Staff = (area?: Area, level: Level = 'view') => SetMetadata(ACCESS, { area, level });
export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request & { admin: Admin }>().admin);

@Injectable()
export class AdminAuthService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  /** Creates a staff account and returns the authenticator secret to hand over once. */
  async createAdmin(input: { email: string; name: string; role: AdminRole; password: string }) {
    const totpSecret = newTotpSecret();
    const [a] = await this.db.insert(admins).values({ email: input.email.toLowerCase(), name: input.name, role: input.role, passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }), totpSecret }).returning({ id: admins.id });
    return { id: a!.id, totpSecret };
  }

  /** Email, password and authenticator code together. The error never says which one was wrong. */
  async login(email: string, password: string, code: string) {
    const [a] = await this.db.select().from(admins).where(eq(admins.email, email.toLowerCase()));
    const passwordOk = a ? await argon2.verify(a.passwordHash, password) : (await argon2.hash(password), false); // same work either way
    if (!a || !a.active || !passwordOk || !totpValid(a.totpSecret, code)) throw unauthorized('bad_login', 'Those details are not right. Check your email, password and authenticator code.');
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(adminSessions).values({ adminId: a.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RULES.adminSessionHours * 3_600_000) });
    return { token, admin: { id: a.id, email: a.email, name: a.name, role: a.role } satisfies Admin };
  }

  async fromToken(token: string): Promise<Admin | null> {
    const [row] = await this.db.select({ a: admins }).from(adminSessions).innerJoin(admins, eq(admins.id, adminSessions.adminId))
      .where(and(eq(adminSessions.tokenHash, sha256(token)), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, new Date()), eq(admins.active, true)));
    if (!row) return null;
    void this.db.update(admins).set({ lastActiveAt: new Date() }).where(eq(admins.id, row.a.id)).catch(() => {});
    return { id: row.a.id, email: row.a.email, name: row.a.name, role: row.a.role };
  }
  async logout(token: string) { await this.db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.tokenHash, sha256(token))); }

  /** Writes one line to the audit log. Call it for every staff action that changes something. */
  async record(admin: Admin, action: string, item: string, req?: Request) {
    await this.db.insert(auditLog).values({ adminId: admin.id, action, item, ip: req?.ip, userAgent: req?.headers['user-agent']?.slice(0, 200) });
  }
  async audit(limit = 100) {
    const rows = await this.db.select({ l: auditLog, name: admins.name, role: admins.role }).from(auditLog).innerJoin(admins, eq(admins.id, auditLog.adminId)).orderBy(desc(auditLog.createdAt)).limit(limit);
    return rows.map(({ l, name, role }) => ({ id: l.id, at: l.createdAt, admin: name, role, action: l.action, item: l.item, ip: l.ip }));
  }
  async staff() {
    const rows = await this.db.select().from(admins).orderBy(admins.createdAt);
    return rows.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, active: a.active, lastActiveAt: a.lastActiveAt }));
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<{ area?: Area; level: Level } | undefined>(ACCESS, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<Request & { admin?: Admin }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const admin = scheme === 'Bearer' && token ? await this.auth.fromToken(token) : null;
    if (!admin) throw unauthorized('admin_signed_out', 'Your session has ended. Sign in again.');
    if (access?.area && !can(admin.role, access.area, access.level)) throw forbidden('not_allowed', 'Your role does not allow this.');
    req.admin = admin;
    return true;
  }
}
