import { Global, Injectable, Module } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { RULES } from '../../config.js';
import { Database } from '../../db/db.module.js';
import { settings } from '../../db/schema.js';

/** The rules staff can change from the console. Everything else in RULES is fixed in code. */
export const settingsShape = z.object({
  dailyWithdrawalLimitKobo: z.number().int().min(1_000_00, 'The daily limit must be at least ₦1,000').max(100_000_000_00),
  holdNewBank: z.boolean(),
  reportsToRereview: z.number().int().min(1, 'Use a number from 1 to 20').max(20, 'Use a number from 1 to 20'),
  deliveryStandardKobo: z.number().int().min(0).max(1_000_000_00),
  deliveryExpressKobo: z.number().int().min(0).max(1_000_000_00),
  minPlanPriceKobo: z.number().int().min(100_00, 'The lowest plan price must be at least ₦100').max(10_000_000_00),
});
export type Settings = z.infer<typeof settingsShape>;
export const DEFAULT_SETTINGS: Settings = {
  dailyWithdrawalLimitKobo: RULES.dailyWithdrawalLimitKobo, holdNewBank: true, reportsToRereview: RULES.reportsToRereview,
  deliveryStandardKobo: RULES.delivery.standard.fee, deliveryExpressKobo: RULES.delivery.express.fee, minPlanPriceKobo: RULES.minPlanPriceKobo,
};
const LABELS: Record<keyof Settings, string> = { dailyWithdrawalLimitKobo: 'daily withdrawal limit', holdNewBank: 'hold for new banks', reportsToRereview: 'reports before re-review', deliveryStandardKobo: 'standard delivery fee', deliveryExpressKobo: 'express delivery fee', minPlanPriceKobo: 'lowest plan price' };

@Injectable()
export class SettingsService {
  constructor(private readonly database: Database) {}

  /** The rules in force now: saved values over the built-in defaults. A saved value that no longer passes the checks is ignored. */
  async get(): Promise<Settings> {
    const rows = await this.database.db.select().from(settings);
    const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) if (r.key in settingsShape.shape && settingsShape.shape[r.key as keyof Settings].safeParse(r.value).success) out[r.key] = r.value;
    return out as Settings;
  }

  /** Saves the values that differ and says which rules changed, for the audit log. */
  async save(adminId: string, patch: Partial<Settings>) {
    const before = await this.get();
    const changed = (Object.keys(patch) as (keyof Settings)[]).filter((k) => patch[k] !== undefined && patch[k] !== before[k]);
    for (const key of changed) {
      await this.database.db.insert(settings).values({ key, value: patch[key], updatedBy: adminId })
        .onConflictDoUpdate({ target: settings.key, set: { value: patch[key], updatedBy: adminId, updatedAt: sql`now()` } });
    }
    return { settings: await this.get(), changed: changed.map((k) => LABELS[k]) };
  }
}

@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
