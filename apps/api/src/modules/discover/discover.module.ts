import { Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, MaybeUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { CommunityModule } from '../community/community.module.js';
import { DiscoverService } from './discover.service.js';

@ApiTags('discover')
@Controller()
class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}
  @Public() @Get('places') places() { return this.discover.places(); }
  @Public() @Get('places/:slug') place(@MaybeUser() u: AuthUser | undefined, @Param('slug') slug: string) { return this.discover.place(slug.toLowerCase(), u?.id); }
  @Public() @Get('search') search(@MaybeUser() u: AuthUser | undefined, @Query('q') q?: string) { return this.discover.search(q ?? '', u?.id); }
  @Public() @Get('travellers/:id') profile(@MaybeUser() u: AuthUser | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.discover.profile(id, u?.id); }
  @ApiBearerAuth() @HttpCode(200) @Post('travellers/:id/follow') follow(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.discover.toggleFollow(u.id, id); }
  @ApiBearerAuth() @Get('feed/following') following(@CurrentUser() u: AuthUser) { return this.discover.followingFeed(u.id); }
}

@Module({ imports: [CommunityModule], controllers: [DiscoverController], providers: [DiscoverService], exports: [DiscoverService] })
export class DiscoverModule {}
