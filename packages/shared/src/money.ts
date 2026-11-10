/** All money is stored as whole kobo (1 naira = 100 kobo), as the ledger does. */
export type Kobo = number;

export const naira = (n: number): Kobo => Math.round(n * 100);

export function formatNaira(kobo: Kobo, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const n = Math.abs(kobo) / 100;
  let body: string;
  if (opts.compact && n >= 1_000_000) body = (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2) + 'M';
  else body = n.toLocaleString('en-NG', { maximumFractionDigits: n % 1 ? 2 : 0 });
  const sign = kobo < 0 ? '−' : opts.sign ? '+' : '';
  return `${sign}₦${body}`;
}

/** Parses "₦50,000" or "50000" to kobo. Returns null when it is not a positive amount. */
export function parseNaira(input: string): Kobo | null {
  const n = Number(input.replace(/[₦,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? naira(n) : null;
}

/** BR-01: 25% platform fee on every trip plan sale. Locked rule. */
export const PLATFORM_FEE_RATE = 0.25;

export function planSaleSplit(price: Kobo) {
  const fee = Math.round(price * PLATFORM_FEE_RATE);
  return { price, fee, sellerGets: price - fee };
}

/** BR-02: a paid plan opens for sale at 06:00 WAT the day after the seller's trip ends. */
export function saleOpensAt(tripEndsOn: string): Date {
  const d = new Date(`${tripEndsOn}T06:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const percent = (part: number, whole: number) =>
  whole <= 0 ? 0 : Math.min(100, Math.floor((part / whole) * 100));
