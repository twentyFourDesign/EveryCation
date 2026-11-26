import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../../common/auth.guard.js';
import { notFound } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { Database } from '../../db/db.module.js';
import { advertisers, packageEvents, travelPackages } from '../../db/schema.js';
import { AdminAuthService, AdminGuard, CurrentAdmin, Staff, type Admin } from '../admin/admin-auth.js';
import { AdminModule } from '../admin/admin.module.js';
import { countryName } from '../travel/travel.module.js';

/** Ad plans, highest first. The rate card sets their prices; this decides where each shows. */
export const PLANS = {
  spotlight: { rank: 3, label: 'Spotlight', where: 'Top of Explore, first in Packages and on matching destinations' },
  featured: { rank: 2, label: 'Featured', where: 'In the Explore carousel and near the top of Packages' },
  listing: { rank: 1, label: 'Listing', where: 'In Packages and on matching destinations' },
} as const;
type Plan = keyof typeof PLANS;
const CHANNELS = ['whatsapp', 'call', 'website', 'save'] as const;
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
const today = () => new Date().toISOString().slice(0, 10);
const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
/** International digits for wa.me and tel: links. Local Nigerian numbers like 0803… become 234803…; others should be typed with their country code. */
const intl = (s: string | null | undefined) => { const d = digits(s); return d.startsWith('0') && d.length === 11 ? `234${d.slice(1)}` : d; };

@Injectable()
export class PackagesService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  private shape(p: typeof travelPackages.$inferSelect, a: typeof advertisers.$inferSelect) {
    const whatsapp = p.whatsapp ?? a.whatsapp; const phone = p.phone ?? a.phone; const website = p.website ?? a.website;
    return {
      id: p.id, title: p.title, summary: p.summary, destination: p.destination, countryCode: p.countryCode, countryName: countryName(p.countryCode), lat: p.lat, lng: p.lng,
      nights: p.nights, price: p.price, priceNote: p.priceNote, includes: p.includes, excludes: p.excludes, itinerary: p.itinerary, vibe: p.vibe,
      imageKey: p.imageKey, imageUrl: p.imageUrl, plan: p.plan as Plan, travelFrom: p.travelFrom, travelTo: p.travelTo,
      advertiser: { id: a.id, name: a.name, kind: a.kind }, sample: a.sample,
      contact: a.sample ? { whatsapp: true, call: true, website: false } : { whatsapp: !!digits(whatsapp), call: !!digits(phone), website: !!website },
    };
  }
  private live() { return and(eq(travelPackages.status, 'live'), sql`${travelPackages.adStarts} <= ${today()}`, sql`(${travelPackages.adEnds} IS NULL OR ${travelPackages.adEnds} >= ${today()})`); }

  /** Packages on show now, highest plan first. `plan` narrows to one placement, like the Explore carousel. */
  async list(q: { country?: string; plan?: string } = {}) {
    const rows = await this.db.select({ p: travelPackages, a: advertisers }).from(travelPackages).innerJoin(advertisers, eq(advertisers.id, travelPackages.advertiserId))
      .where(and(this.live(), q.country ? eq(travelPackages.countryCode, q.country.toUpperCase()) : undefined))
      .orderBy(sql`CASE ${travelPackages.plan} WHEN 'spotlight' THEN 3 WHEN 'featured' THEN 2 ELSE 1 END DESC`, desc(travelPackages.createdAt));
    const all = rows.map(({ p, a }) => this.shape(p, a));
    if (q.plan === 'featured') return all.filter((p) => p.plan !== 'listing');
    return all;
  }

  async get(id: string, viewer?: string) {
    const [row] = await this.db.select({ p: travelPackages, a: advertisers }).from(travelPackages).innerJoin(advertisers, eq(advertisers.id, travelPackages.advertiserId)).where(and(eq(travelPackages.id, id), this.live()));
    if (!row) throw notFound('Package');
    await this.db.insert(packageEvents).values({ packageId: id, kind: 'view', userId: viewer });
    return this.shape(row.p, row.a);
  }

  /** Counts an enquiry and returns where to send the traveller: WhatsApp, a phone call or the advertiser's website. */
  async enquire(id: string, channel: (typeof CHANNELS)[number], viewer?: string) {
    const [row] = await this.db.select({ p: travelPackages, a: advertisers }).from(travelPackages).innerJoin(advertisers, eq(advertisers.id, travelPackages.advertiserId)).where(and(eq(travelPackages.id, id), this.live()));
    if (!row) throw notFound('Package');
    const { p, a } = row;
    const message = `Hello ${a.name}, I saw your "${p.title}" package on EveryCation and would like to know more.`;
    const wa = intl(p.whatsapp ?? a.whatsapp); const tel = intl(p.phone ?? a.phone);
    const url = channel === 'whatsapp' ? (wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : null)
      : channel === 'call' ? (tel ? `tel:+${tel}` : null)
      : channel === 'website' ? p.website ?? a.website : null;
    await this.db.insert(packageEvents).values({ packageId: id, kind: channel, userId: viewer });
    // Showcase packages count the tap but never send a traveller to a made-up number.
    if (a.sample) return { url: null, sample: true };
    if (channel !== 'save' && !url) throw notFound('Contact');
    return { url, sample: false };
  }

  // ───────────── Staff ─────────────
  async adminList() {
    const rows = await this.db.select({ p: travelPackages, a: advertisers }).from(travelPackages).innerJoin(advertisers, eq(advertisers.id, travelPackages.advertiserId)).orderBy(desc(travelPackages.createdAt));
    const stats = await this.db.execute(sql`SELECT package_id, kind, count(*)::int AS n, count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS recent FROM package_events GROUP BY package_id, kind`);
    const by = new Map<string, Record<string, { n: number; recent: number }>>();
    for (const r of stats.rows as { package_id: string; kind: string; n: number; recent: number }[]) by.set(r.package_id, { ...by.get(r.package_id), [r.kind]: { n: r.n, recent: r.recent } });
    const t = today();
    return rows.map(({ p, a }) => {
      const s = by.get(p.id) ?? {}; const views = s.view?.n ?? 0; const enquiries = CHANNELS.filter((c) => c !== 'save').reduce((n, c) => n + (s[c]?.n ?? 0), 0);
      const running = p.status === 'live' && p.adStarts <= t && (!p.adEnds || p.adEnds >= t);
      return { ...this.shape(p, a), status: p.status, running, adStarts: p.adStarts, adEnds: p.adEnds, whatsapp: p.whatsapp, phone: p.phone, website: p.website,
        stats: { views, viewsLast30: s.view?.recent ?? 0, enquiries, whatsapp: s.whatsapp?.n ?? 0, call: s.call?.n ?? 0, websiteClicks: s.website?.n ?? 0, saves: s.save?.n ?? 0, enquiryRate: views ? Math.round((enquiries / views) * 1000) / 10 : 0 } };
    });
  }
  async advertiserList() {
    const r = await this.db.execute(sql`SELECT a.*, count(p.id)::int AS packages, count(p.id) FILTER (WHERE p.status = 'live')::int AS live FROM advertisers a LEFT JOIN travel_packages p ON p.advertiser_id = a.id GROUP BY a.id ORDER BY a.name`);
    return (r.rows as Record<string, unknown>[]).map((a) => ({ id: a.id, name: a.name, kind: a.kind, contactName: a.contact_name, email: a.email, phone: a.phone, whatsapp: a.whatsapp, website: a.website, sample: a.sample, packages: a.packages, live: a.live }));
  }
  async saveAdvertiser(id: string | null, b: Partial<typeof advertisers.$inferInsert>) {
    if (id) { const [a] = await this.db.update(advertisers).set(b).where(eq(advertisers.id, id)).returning(); if (!a) throw notFound('Advertiser'); return a; }
    const [a] = await this.db.insert(advertisers).values(b as typeof advertisers.$inferInsert).returning(); return a!;
  }
  async savePackage(id: string | null, b: Partial<typeof travelPackages.$inferInsert>) {
    if (id) { const [p] = await this.db.update(travelPackages).set(b).where(eq(travelPackages.id, id)).returning(); if (!p) throw notFound('Package'); return p; }
    const [p] = await this.db.insert(travelPackages).values(b as typeof travelPackages.$inferInsert).returning(); return p!;
  }
}

/** Leaving a field out keeps it; sending it empty clears it. No defaults here, so a one-field edit never resets the rest (the table has the defaults). */
const optional = z.string().trim().max(200).optional().transform((v) => (v === undefined ? undefined : v || null));
const advertiserBody = z.object({ name: z.string().trim().min(2, 'Add the company name').max(80), kind: z.enum(['agency', 'hotel', 'tour_operator', 'other']).optional(),
  contactName: optional, email: z.email('Enter a valid email').optional().or(z.literal('')).transform((v) => (v === undefined ? undefined : v || null)), phone: optional, whatsapp: optional, website: z.url('Enter the full address, starting https://').optional().or(z.literal('')).transform((v) => (v === undefined ? undefined : v || null)) });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const packageBody = z.object({
  advertiserId: z.uuid('Choose the advertiser'), title: z.string().trim().min(4, 'Give the package a title').max(80), summary: z.string().trim().max(400).optional(),
  destination: z.string().trim().min(2, 'Add where it goes').max(80), countryCode: z.string().length(2, 'Choose a country').transform((c) => c.toUpperCase()),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(), nights: z.number().int().min(0).max(60),
  price: z.number().int().positive('Set a price'), priceNote: z.string().trim().max(80).optional(),
  includes: z.array(z.string().trim().min(2).max(120)).max(20).optional(), excludes: z.array(z.string().trim().min(2).max(120)).max(20).optional(),
  itinerary: z.array(z.object({ day: z.string().trim().max(20), title: z.string().trim().min(2).max(80), detail: z.string().trim().max(300) })).max(30).optional(),
  vibe: z.enum(['beach', 'city', 'adventure', 'food', 'culture', 'nature']).optional(), imageKey: z.string().max(40).optional(), imageUrl: z.string().max(300).optional(),
  plan: z.enum(['listing', 'featured', 'spotlight']).optional(), status: z.enum(['draft', 'live', 'paused']).optional(),
  adStarts: day, adEnds: day.optional().nullable(), travelFrom: day.optional().nullable(), travelTo: day.optional().nullable(),
  whatsapp: optional, phone: optional, website: optional,
});

@ApiTags('packages')
@Controller('packages')
class PackagesController {
  constructor(private readonly packages: PackagesService) {}
  @Public() @Get() list(@Query('country') country?: string, @Query('plan') plan?: string) { return this.packages.list({ country, plan }); }
  @Public() @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.packages.get(id); }
  @Public() @HttpCode(200) @Post(':id/enquire') enquire(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(z.object({ channel: z.enum(CHANNELS) }))) b: { channel: (typeof CHANNELS)[number] }) { return this.packages.enquire(id, b.channel); }
}

@ApiTags('admin') @ApiBearerAuth()
@Public() @UseGuards(AdminGuard)
@Controller('admin')
class PackagesAdminController {
  constructor(private readonly packages: PackagesService, private readonly auth: AdminAuthService) {}
  @Staff('ads') @Get('packages') list() { return this.packages.adminList(); }
  @Staff('ads') @Get('advertisers') advertisers() { return this.packages.advertiserList(); }
  @Staff('ads') @Get('ad-plans') plans() { return PLANS; }
  @Staff('ads', 'edit') @Post('advertisers')
  async addAdvertiser(@CurrentAdmin() admin: Admin, @Body(new ZodPipe(advertiserBody)) b: z.infer<typeof advertiserBody>, @Req() req: Request) {
    const a = await this.packages.saveAdvertiser(null, b); await this.auth.record(admin, 'Added advertiser', a.name, req); return { id: a.id };
  }
  @Staff('ads', 'edit') @Patch('advertisers/:id')
  async editAdvertiser(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(advertiserBody.partial())) b: Partial<z.infer<typeof advertiserBody>>, @Req() req: Request) {
    const a = await this.packages.saveAdvertiser(id, b); await this.auth.record(admin, 'Edited advertiser', a.name, req); return { id: a.id };
  }
  @Staff('ads', 'edit') @Post('packages')
  async addPackage(@CurrentAdmin() admin: Admin, @Body(new ZodPipe(packageBody)) b: z.infer<typeof packageBody>, @Req() req: Request) {
    const p = await this.packages.savePackage(null, b); await this.auth.record(admin, 'Added package', `${p.title} · ${PLANS[p.plan as Plan].label} · ${naira(p.price)}`, req); return { id: p.id };
  }
  @Staff('ads', 'edit') @Patch('packages/:id')
  async editPackage(@CurrentAdmin() admin: Admin, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(packageBody.partial())) b: Partial<z.infer<typeof packageBody>>, @Req() req: Request) {
    const p = await this.packages.savePackage(id, b);
    await this.auth.record(admin, b.status === 'paused' ? 'Paused package' : b.status === 'live' ? 'Put package live' : 'Edited package', `${p.title} · ${PLANS[p.plan as Plan].label}`, req); return { id: p.id };
  }
}

@Module({ imports: [AdminModule], controllers: [PackagesController, PackagesAdminController], providers: [PackagesService], exports: [PackagesService] })
export class PackagesModule {}
