import { Module } from '@nestjs/common';
import { Ledger } from './ledger.service.js';
import { BankDirectory, IdentityVerifier, SandboxBankDirectory, SandboxIdentityVerifier } from './partners.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';
import { PartnerWebhookController } from './webhook.controller.js';

@Module({
  controllers: [WalletController, PartnerWebhookController],
  providers: [Ledger, WalletService, { provide: IdentityVerifier, useClass: SandboxIdentityVerifier }, { provide: BankDirectory, useClass: SandboxBankDirectory }],
  exports: [Ledger, WalletService],
})
export class WalletModule {}
