import { createParamDecorator, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { Database } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { forbidden, unauthorized } from './errors.js';

export interface AuthUser { id: string; sessionFamily: string }
const PUBLIC = 'isPublic';
/** Marks a route that needs no sign-in. Everything else requires a valid access token. */
export const Public = () => SetMetadata(PUBLIC, true);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly database: Database) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();
    let payload: { sub: string; fam: string };
    try { payload = await this.jwt.verifyAsync(token); } catch { throw unauthorized('token_expired', 'Your session has expired. Please sign in again.'); }
    const [user] = await this.database.db.select({ status: users.status }).from(users).where(eq(users.id, payload.sub));
    if (!user) throw unauthorized();
    if (user.status !== 'active') throw forbidden('account_suspended', 'This account is suspended. Contact support.');
    req.user = { id: payload.sub, sessionFamily: payload.fam };
    return true;
  }
}
