import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ConsoleSmsSender, SmsSender } from './sms.js';

@Module({ controllers: [AuthController], providers: [AuthService, { provide: SmsSender, useClass: ConsoleSmsSender }], exports: [AuthService] })
export class AuthModule {}
