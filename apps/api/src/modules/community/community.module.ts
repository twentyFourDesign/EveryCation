import { Module } from '@nestjs/common';
import { AdviceService } from './advice.service.js';
import { CommunityController } from './community.controller.js';
import { TipsService } from './tips.service.js';

@Module({ controllers: [CommunityController], providers: [TipsService, AdviceService], exports: [TipsService, AdviceService] })
export class CommunityModule {}
