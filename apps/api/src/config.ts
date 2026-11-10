import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  OTP_SECRET: z.string().min(32, 'OTP_SECRET must be at least 32 characters'),
  PARTNER_WEBHOOK_SECRET: z.string().min(16),
  /** Where uploads are kept on disk in development. In production, point MediaStorage at S3 instead. */
  MEDIA_DIR: z.string().default('./uploads'),
  /** The address clients reach this API on, used to build media links. */
  PUBLIC_URL: z.string().optional(),
});

export type Config = z.infer<typeof schema>;
export const CONFIG = Symbol('CONFIG');

/** Reads and checks the environment once at start-up. The API refuses to boot on a bad value. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error('Invalid environment: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}

/** Product rules from the spec (section 5). Later these move to the settings table the admin console edits. */
export const RULES = {
  otpTtlMinutes: 10,
  otpMaxAttempts: 5,
  otpResendSeconds: 60,
  accessTokenMinutes: 15,
  refreshTokenDays: 30,
  pinMaxAttempts: 3,
  pinLockMinutes: 15,
  dailyWithdrawalLimitKobo: 300_000_00,
  newBankHoldHours: 24,
  minMoneyKobo: 1_000_00,
  adminSessionHours: 12,
  /** Verified advice goes back to review after this many reports from different users. */
  reportsToRereview: 3,
} as const;
