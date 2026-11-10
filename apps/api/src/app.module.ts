import { Controller, Get, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { AuthGuard, Public } from './common/auth.guard.js';
import { CONFIG, loadConfig, RULES, type Config } from './config.js';
import { Database, DbModule } from './db/db.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CommunityModule } from './modules/community/community.module.js';
import { WalletModule } from './modules/wallet/wallet.module.js';

@Controller('health')
class HealthController {
  constructor(private readonly database: Database) {}
  @Public() @Get() async check() { await this.database.db.execute(sql`select 1`); return { status: 'ok' }; }
}

@Global()
@Module({ providers: [{ provide: CONFIG, useFactory: () => loadConfig() }], exports: [CONFIG] })
class ConfigModule {}

@Module({
  imports: [
    ConfigModule,
    DbModule,
    JwtModule.registerAsync({ global: true, inject: [CONFIG], useFactory: (c: Config) => ({ secret: c.JWT_SECRET, signOptions: { expiresIn: `${RULES.accessTokenMinutes}m`, issuer: 'everycation' }, verifyOptions: { issuer: 'everycation' } }) }),
    ThrottlerModule.forRootAsync({ inject: [CONFIG], useFactory: (c: Config) => ({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => c.NODE_ENV === 'test' }) }),
    AuthModule,
    WalletModule,
    CommunityModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
