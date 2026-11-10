import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthService } from './auth.service.js';

const requestBody = z.object({ phone: z.string().min(7).max(20) });
const verifyBody = z.object({ phone: z.string().min(7).max(20), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'), device: z.string().max(120).optional() });
const refreshBody = z.object({ refreshToken: z.string().min(20) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200)
  @Post('otp/request')
  request(@Body(new ZodPipe(requestBody)) body: z.infer<typeof requestBody>) { return this.auth.requestCode(body.phone); }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('otp/verify')
  verify(@Body(new ZodPipe(verifyBody)) body: z.infer<typeof verifyBody>) { return this.auth.verifyCode(body.phone, body.code, body.device); }

  @Public() @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodPipe(refreshBody)) body: z.infer<typeof refreshBody>) { return this.auth.refresh(body.refreshToken); }

  @ApiBearerAuth() @HttpCode(204)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) { return this.auth.logout(user.sessionFamily); }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) { return this.auth.me(user.id); }
}
