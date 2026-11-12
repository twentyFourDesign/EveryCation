import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/everycation_test';

export default defineConfig({
  // NestJS needs decorator metadata, which esbuild does not emit; swc does.
  plugins: [swc.vite({ jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022' }, module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DB, JWT_SECRET: 'test-jwt-secret-test-jwt-secret-test-jwt', OTP_SECRET: 'test-otp-secret-test-otp-secret-test-otp', PARTNER_WEBHOOK_SECRET: 'test-partner-secret', MEDIA_DIR: '/tmp/everycation-test-uploads',
      GOOGLE_CLIENT_ID: 'test-google-client', GOOGLE_CLIENT_SECRET: 'test-google-secret', APPLE_AUDIENCES: 'app.everycation.test', GEOCODER_URL: 'http://127.0.0.1:4599' },
  },
});
