import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { AdminAuthService, type AdminRole } from '../modules/admin/admin-auth.js';
import { otpauthUrl } from '../modules/admin/totp.js';

/** Usage: node dist/scripts/create-admin.js <email> "<name>" <role>   (role: super_admin, moderator, finance, shop_ops, support) */
const [email, name, role = 'super_admin'] = process.argv.slice(2);
if (!email || !name) { console.error('Usage: create-admin <email> "<name>" [role]'); process.exit(1); }
const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const password = randomBytes(12).toString('base64url');
const { totpSecret } = await app.get(AdminAuthService).createAdmin({ email, name, role: role as AdminRole, password });
console.log(`Staff account created for ${email} (${role}).\n\nTemporary password: ${password}\nAuthenticator secret: ${totpSecret}\nOr add it by link:    ${otpauthUrl(email, totpSecret)}\n\nShare these once, over a safe channel. They are not shown again.`);
await app.close();
