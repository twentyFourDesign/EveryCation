import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { AdminAuthService } from '../modules/admin/admin-auth.js';
import { otpauthUrl } from '../modules/admin/totp.js';

/** Usage: node dist/scripts/reset-admin.js <email>   New password and authenticator secret; old ones and open sessions stop working. */
const [email] = process.argv.slice(2);
if (!email) { console.error('Usage: reset-admin <email>'); process.exit(1); }
const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const password = randomBytes(12).toString('base64url');
const result = await app.get(AdminAuthService).resetAdmin(email, password);
if (!result) { console.error(`No staff account for ${email}.`); await app.close(); process.exit(1); }
console.log(`Sign-in details reset for ${email}. The old password and authenticator entry no longer work.\n\nNew password:         ${password}\nAuthenticator secret: ${result.totpSecret}\nOr add it by link:    ${otpauthUrl(email, result.totpSecret)}\n\nShown once. Keep them in a password manager and do not paste them anywhere.`);
await app.close();
