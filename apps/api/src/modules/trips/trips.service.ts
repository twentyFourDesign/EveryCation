import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { badRequest, notFound } from '../../common/errors.js';
import { Database } from '../../db/db.module.js';
import { bucketItems, itineraryItems, trips } from '../../db/schema.js';

export interface TripInput { title: string; place: string; countryCode: string; startDate: string; endDate: string; travellers?: number; imageKey?: string }
export interface ItemInput { day: string; time: string; title: string; note?: string; remind?: string }
/** Today's date in Lagos, as YYYY-MM-DD. Trip dates are calendar days, not instants. */
export const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const nights = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

@Injectable()
export class TripsService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  view(t: typeof trips.$inferSelect) {
    const today = lagosToday();
    const status = t.endDate < today ? 'past' as const : t.startDate > today ? 'upcoming' as const : 'now' as const;
    return { id: t.id, title: t.title, place: t.place, countryCode: t.countryCode, startDate: t.startDate, endDate: t.endDate, nights: nights(t.startDate, t.endDate), travellers: t.travellers, imageKey: t.imageKey, status,
      daysAway: status === 'upcoming' ? nights(today, t.startDate) : null };
  }
  private async own(userId: string, id: string) {
    const [t] = await this.db.select().from(trips).where(and(eq(trips.id, id), eq(trips.userId, userId)));
    if (!t) throw notFound('Trip');
    return t;
  }

  async list(userId: string) { return (await this.db.select().from(trips).where(eq(trips.userId, userId)).orderBy(desc(trips.startDate))).map((t) => this.view(t)); }
  async get(userId: string, id: string) {
    const t = await this.own(userId, id);
    const items = await this.db.select().from(itineraryItems).where(eq(itineraryItems.tripId, id)).orderBy(itineraryItems.day, itineraryItems.time);
    return { ...this.view(t), itinerary: items.map((i) => ({ id: i.id, day: i.day, time: i.time, title: i.title, note: i.note, remind: i.remind })) };
  }
  async create(userId: string, input: TripInput) {
    if (input.endDate < input.startDate) throw badRequest('dates_out_of_order', 'The trip cannot end before it starts.');
    const [t] = await this.db.insert(trips).values({ userId, ...input, countryCode: input.countryCode.toUpperCase() }).returning();
    return this.view(t!);
  }
  async update(userId: string, id: string, patch: Partial<TripInput>) {
    const t = await this.own(userId, id);
    const next = { ...t, ...patch };
    if (next.endDate < next.startDate) throw badRequest('dates_out_of_order', 'The trip cannot end before it starts.');
    const [u] = await this.db.update(trips).set({ ...patch, countryCode: patch.countryCode?.toUpperCase() }).where(eq(trips.id, id)).returning();
    return this.view(u!);
  }
  async addItem(userId: string, tripId: string, input: ItemInput) {
    const t = await this.own(userId, tripId);
    if (input.day < t.startDate || input.day > t.endDate) throw badRequest('day_outside_trip', 'Choose a day during the trip.');
    await this.db.insert(itineraryItems).values({ tripId, ...input, note: input.note ?? '' });
    return this.get(userId, tripId);
  }
  async removeItem(userId: string, tripId: string, itemId: string) {
    await this.own(userId, tripId);
    await this.db.delete(itineraryItems).where(and(eq(itineraryItems.id, itemId), eq(itineraryItems.tripId, tripId)));
    return this.get(userId, tripId);
  }

  // ───────────── Bucket list ─────────────
  async bucket(userId: string) { return (await this.db.select().from(bucketItems).where(eq(bucketItems.userId, userId)).orderBy(bucketItems.state, desc(bucketItems.createdAt))).map((b) => ({ id: b.id, title: b.title, state: b.state, source: b.source, imageKey: b.imageKey })); }
  async addBucket(userId: string, input: { title: string; source?: string; imageKey?: string }) {
    await this.db.insert(bucketItems).values({ userId, ...input }).onConflictDoNothing();
    return this.bucket(userId);
  }
  async setBucketState(userId: string, id: string, state: 'dream' | 'done') {
    const [b] = await this.db.update(bucketItems).set({ state }).where(and(eq(bucketItems.id, id), eq(bucketItems.userId, userId))).returning({ id: bucketItems.id });
    if (!b) throw notFound('Bucket list item');
    return this.bucket(userId);
  }
  async removeBucket(userId: string, id: string) { await this.db.delete(bucketItems).where(and(eq(bucketItems.id, id), eq(bucketItems.userId, userId))); return this.bucket(userId); }
}
