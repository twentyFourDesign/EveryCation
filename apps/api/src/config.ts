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
  /** Mail server for sign-in codes, like smtps://user:password@smtp.provider.com:465. Without it, emails are written to the log. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('EveryCation <no-reply@everycation.app>'),
  /** Google sign-in and Calendar sync: a "Web application" OAuth client from Google Cloud. Its redirect URI is PUBLIC_URL + /v1/auth/google/callback. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Sign in with Apple: the app's bundle ID (and a Services ID, if one is added later), comma-separated. Empty turns it off. */
  APPLE_AUDIENCES: z.string().optional(),
  /** Where a finished Google sign-in may send people back to, comma-separated prefixes. The app's own scheme is always allowed. */
  APP_RETURN_URLS: z.string().default(''),
  /** Place search for trips. A Photon server (OpenStreetMap data); empty searches only the places staff added. */
  GEOCODER_URL: z.string().default('https://photon.komoot.io'),
  /** Set to 0 to stop this server running timed jobs, e.g. when a separate worker runs them. */
  JOBS_ENABLED: z.enum(['0', '1']).optional(),
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
  /** BR-01: the platform keeps 25% of every trip plan sale. Locked rule. */
  planFeeRate: 0.25,
  minPlanPriceKobo: 1_000_00,
  /** Delivery prices. Placeholders until the delivery partner's rates are agreed. */
  delivery: { standard: { fee: 2_500_00, label: 'Standard', eta: '3 to 5 working days' }, express: { fee: 5_000_00, label: 'Express', eta: '1 to 2 working days' } },
  adminSessionHours: 12,
  /** Verified advice goes back to review after this many reports from different users. */
  reportsToRereview: 3,
} as const;
