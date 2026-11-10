import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { CONFIG, type Config } from './config.js';
import { DiskStorage } from './modules/media/media.service.js';

export async function createApp() {
  // rawBody keeps the exact bytes of each request so webhook signatures can be checked.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, logger: process.env.NODE_ENV === 'test' ? false : undefined });
  app.setGlobalPrefix('v1');
  // The mobile apps are not browsers and need no CORS; this is for the Expo web build and the admin console in development.
  if (process.env.NODE_ENV !== 'production') app.enableCors({ origin: true, allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'] });
  app.disable('x-powered-by');
  // Uploaded media in development. In production the CDN serves these straight from object storage.
  app.useStaticAssets(app.get(DiskStorage).root, { prefix: '/media', maxAge: '7d', index: false });
  app.enableShutdownHooks();
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = await createApp();
  const config = app.get<Config>(CONFIG);
  if (config.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('EveryCation API').setVersion('0.1').addBearerAuth().build());
    SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/openapi.json' });
  }
  await app.listen(config.PORT);
  console.log(`EveryCation API on http://localhost:${config.PORT}/v1 (docs at /docs)`);
}
