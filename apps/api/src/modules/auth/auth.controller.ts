import { Body, Controller, Get, HttpCode, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { SocialAuthService } from './social.service.js';

const requestBody = z.object({ email: z.string().min(5).max(254) });
const verifyBody = z.object({ email: z.string().min(5).max(254), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'), device: z.string().max(120).optional() });
const profileBody = z.object({ name: z.string().trim().min(2, 'Enter your name').max(60), handle: z.string().trim().regex(/^[a-zA-Z0-9._]{3,24}$/, 'Use 3 to 24 letters, numbers, dots or underscores'), city: z.string().trim().max(60), bio: z.string().trim().max(200) }).partial();
const handoffBody = z.object({ code: z.string().min(20).max(100), device: z.string().max(120).optional() });
const appleBody = z.object({ identityToken: z.string().min(20).max(5000), name: z.string().trim().max(60).optional(), device: z.string().max(120).optional() });
const refreshBody = z.object({ refreshToken: z.string().min(20) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly social: SocialAuthService) {}

  /** Which sign-in buttons the app should show. They appear once the keys are set on the server. */
  @Public() @Get('providers') providers() { return this.social.providers(); }

  /** Step 1 of Google sign-in: the app opens this in the browser and we pass the person on to Google. */
  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @Get('google/start')
  async googleStart(@Query('returnTo') returnTo: string | undefined, @Res() res: Response) { res.redirect(await this.social.startUrl('sign_in', returnTo ?? '')); }
  /** Step 2: Google sends the browser back here, and we send it on into the app with a one-time code. */
  @Public() @Get('google/callback')
  async googleCallback(@Query() q: { code?: string; state?: string; error?: string }, @Res() res: Response) { res.redirect(await this.social.callback(q)); }
  /** Step 3: the app swaps the one-time code for a session. */
  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('handoff')
  handoff(@Body(new ZodPipe(handoffBody)) b: z.infer<typeof handoffBody>) { return this.social.redeem(b.code, b.device); }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('apple')
  apple(@Body(new ZodPipe(appleBody)) b: z.infer<typeof appleBody>) { return this.social.appleSignIn(b.identityToken, b.name, b.device); }

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200)
  @Post('otp/request')
  request(@Body(new ZodPipe(requestBody)) body: z.infer<typeof requestBody>) { return this.auth.requestCode(body.email); }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('otp/verify')
  verify(@Body(new ZodPipe(verifyBody)) body: z.infer<typeof verifyBody>) { return this.auth.verifyCode(body.email, body.code, body.device); }

  @Public() @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodPipe(refreshBody)) body: z.infer<typeof refreshBody>) { return this.auth.refresh(body.refreshToken); }

  @ApiBearerAuth() @HttpCode(204)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) { return this.auth.logout(user.sessionFamily); }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) { return this.auth.me(user.id); }

  @ApiBearerAuth()
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(profileBody)) body: z.infer<typeof profileBody>) { return this.auth.updateProfile(user.id, body); }
}
