import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CONFIG, type Config } from '../../config.js';
import { ConsoleEmailSender, EmailSender, SmtpEmailSender } from './email.js';

@Module({ controllers: [AuthController], providers: [AuthService, { provide: EmailSender, inject: [CONFIG], useFactory: (c: Config) => (c.SMTP_URL ? new SmtpEmailSender(c) : new ConsoleEmailSender()) }], exports: [AuthService] })
export class AuthModule {}
