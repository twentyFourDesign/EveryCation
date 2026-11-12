import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { DiscoverModule } from '../discover/discover.module.js';
import { ShopModule } from '../shop/shop.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminAuthService, AdminGuard } from './admin-auth.js';
import { AdminController, AdminLoginController } from './admin.controller.js';
import { AdminUsersService, AdminWalletService } from './admin.service.js';
import { BroadcastsService } from './broadcasts.service.js';

@Module({ imports: [WalletModule, CommunityModule, PlansModule, ShopModule, DiscoverModule], controllers: [AdminLoginController, AdminController], providers: [AdminAuthService, AdminGuard, AdminWalletService, AdminUsersService, BroadcastsService], exports: [AdminAuthService] })
export class AdminModule {}
