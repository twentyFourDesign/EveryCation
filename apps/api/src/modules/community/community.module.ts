import { Module } from '@nestjs/common';
import { AdviceService } from './advice.service.js';
import { CommunityController } from './community.controller.js';
import { ModerationService } from './moderation.service.js';
import { NotificationsService } from './notifications.service.js';
import { TipsService } from './tips.service.js';

@Module({ controllers: [CommunityController], providers: [TipsService, AdviceService, NotificationsService, ModerationService], exports: [TipsService, AdviceService, NotificationsService, ModerationService] })
export class CommunityModule {}
