import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, MaybeUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AdviceService } from './advice.service.js';
import { NotificationsService } from './notifications.service.js';
import { TipsService } from './tips.service.js';

const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max);
const tipBody = z.object({ title: text(8, 80, 'Write a headline of at least 8 characters'), place: text(2, 80, 'Add the place'), countryCode: z.string().length(2).optional(), category: text(2, 30, 'Choose a category'), format: z.enum(['write', 'video', 'voice']).default('write'),
  body: z.string().trim().max(1200).default(''), goodToKnow: z.array(z.string().trim().min(1).max(160)).max(5).optional(), imageKey: z.string().max(40).optional(), visited: z.string().trim().max(40).optional() });
const commentBody = z.object({ body: text(1, 500, 'Write a comment') });
const adviceBody = z.object({ countryCode: z.string().length(2, 'Choose a country'), city: text(2, 60, 'Choose a location'), topic: text(2, 30, 'Choose a topic'), body: text(30, 600, 'Write at least 30 characters so it is useful'), visited: z.string().trim().max(40).optional(), showPassport: z.boolean().optional() });
const reviseBody = adviceBody.pick({ body: true });
const reportBody = z.object({ targetType: z.enum(['tip', 'comment', 'advice']), targetId: z.uuid(), reason: text(3, 200, 'Say what is wrong') });

@ApiTags('community')
@Controller()
export class CommunityController {
  constructor(private readonly tips: TipsService, private readonly advice: AdviceService, private readonly notifications: NotificationsService) {}

  @ApiBearerAuth() @Get('notifications') inbox(@CurrentUser() u: AuthUser) { return this.notifications.list(u.id); }
  @ApiBearerAuth() @Get('notifications/unread') unread(@CurrentUser() u: AuthUser) { return this.notifications.unread(u.id); }
  @ApiBearerAuth() @HttpCode(204) @Post('notifications/read') read(@CurrentUser() u: AuthUser) { return this.notifications.markAllRead(u.id); }

  // Reading is open to guests; a valid token adds "liked by me" and the reader's own unreviewed advice.
  @Public() @Get('tips')
  list(@MaybeUser() u: AuthUser | undefined, @Query('feed') feed?: string, @Query('authorId') authorId?: string, @Query('q') q?: string) {
    return this.tips.list({ feed: feed === 'popular' ? 'popular' : 'latest', authorId: z.uuid().safeParse(authorId).data, search: q }, u?.id);
  }
  @Public() @Get('tips/:id') tip(@MaybeUser() u: AuthUser | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.tips.get(id, u?.id); }
  @Public() @Get('tips/:id/comments') comments(@MaybeUser() u: AuthUser | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.tips.comments(id, u?.id); }
  @Public() @Get('users/:id') profile(@Param('id', ParseUUIDPipe) id: string) { return this.tips.profile(id); }
  @Public() @Get('advice/countries') countries() { return this.advice.countries(); }
  @Public() @Get('advice')
  adviceList(@MaybeUser() u: AuthUser | undefined, @Query('country') country: string, @Query('verifiedOnly') verifiedOnly?: string) {
    return this.advice.list({ countryCode: z.string().length(2).parse(country), verifiedOnly: verifiedOnly !== 'false' }, u?.id);
  }

  @ApiBearerAuth() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('tips') create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(tipBody)) b: z.infer<typeof tipBody>) { return this.tips.create(u.id, b); }
  @ApiBearerAuth() @HttpCode(200)
  @Post('tips/:id/like') like(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.tips.toggleLike(u.id, id); }
  @ApiBearerAuth() @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('tips/:id/comments') comment(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(commentBody)) b: z.infer<typeof commentBody>) { return this.tips.addComment(u.id, id, b.body); }

  @ApiBearerAuth() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('advice') share(@CurrentUser() u: AuthUser, @Body(new ZodPipe(adviceBody)) b: z.infer<typeof adviceBody>) { return this.advice.create(u.id, b); }
  @ApiBearerAuth()
  @Patch('advice/:id') revise(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reviseBody)) b: z.infer<typeof reviseBody>) { return this.advice.revise(u.id, id, b.body); }
  @ApiBearerAuth() @HttpCode(200)
  @Post('advice/:id/helpful') helpful(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.advice.toggleHelpful(u.id, id); }

  @ApiBearerAuth() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @HttpCode(200)
  @Post('reports') report(@CurrentUser() u: AuthUser, @Body(new ZodPipe(reportBody)) b: z.infer<typeof reportBody>) { return this.tips.report(u.id, b.targetType, b.targetId, b.reason); }
}
