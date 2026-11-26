import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { and, asc, eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard.js';
import { badRequest, notFound } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { Database } from '../../db/db.module.js';
import { checklistItems, travelChecklists, trips } from '../../db/schema.js';

/** Entry requirements for every passport and destination. See data/README.md for the source and how to refresh it. */
const data = JSON.parse(readFileSync(new URL('../../../data/visa.json', import.meta.url), 'utf8')) as { updated: string; source: string; codes: string[]; rows: Record<string, string> };
const index = new Map(data.codes.map((c, i) => [c, i]));
/** Changes announced after visa.json was published, applied on top of it. See data/visa-overrides.json. */
interface Rule { to: string; from: string[]; entry?: string; days?: number; since: string; summary?: string; apply?: { label: string; url: string }; notes?: string[]; checklist?: string[]; sources?: string[] }
const overrides = (JSON.parse(readFileSync(new URL('../../../data/visa-overrides.json', import.meta.url), 'utf8')) as { rules: Rule[] }).rules;
const ruleFor = (from: string, to: string) => overrides.find((r) => r.to === to && r.from.includes(from));
const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string) => { try { return names.of(code) ?? code; } catch { return code; } };
const COUNTRIES = data.codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

export type Entry = 'visa_free' | 'visa_on_arrival' | 'eta' | 'e_visa' | 'visa_required' | 'no_admission' | 'own_country' | 'unknown';
const CODES: Record<string, Entry> = { f: 'visa_free', a: 'visa_on_arrival', t: 'eta', e: 'e_visa', v: 'visa_required', x: 'no_admission', '-': 'own_country' };
const TITLES: Record<Entry, string> = { visa_free: 'No visa needed', visa_on_arrival: 'Visa on arrival', eta: 'Travel authorisation (ETA)', e_visa: 'e-Visa', visa_required: 'Visa required', no_admission: 'Entry not allowed', own_country: 'Your own country', unknown: 'Not known' };
const TONES: Record<Entry, 'good' | 'warn' | 'bad' | 'neutral'> = { visa_free: 'good', visa_on_arrival: 'good', eta: 'warn', e_visa: 'warn', visa_required: 'bad', no_admission: 'bad', own_country: 'neutral', unknown: 'neutral' };

function lookup(from: string, to: string): { entry: Entry; days: number | null } {
  const row = data.rows[from]; const i = index.get(to);
  const cell = row && i !== undefined ? row.split(',')[i] : undefined;
  if (!cell) return { entry: 'unknown', days: null };
  return /^\d+$/.test(cell) ? { entry: 'visa_free', days: Number(cell) } : { entry: CODES[cell] ?? 'unknown', days: null };
}

/** What a traveller with this passport needs to enter that country. */
export function requirements(from: string, to: string) {
  const rule = ruleFor(from, to); const base = lookup(from, to);
  const entry = (rule?.entry as Entry | undefined) ?? base.entry; const days = rule?.entry ? rule.days ?? null : base.days; const country = countryName(to);
  const summary = {
    visa_free: days ? `No visa needed for stays of up to ${days} days.` : 'No visa needed.',
    visa_on_arrival: 'You get your visa when you land. Have the fee ready, often in cash.',
    eta: 'You need an electronic travel authorisation (ETA) before you fly. It is usually quick to get online.',
    e_visa: 'You need an e-visa. Apply online on the official government website before you travel.',
    visa_required: `You need a visa before you travel. Apply at the ${country} embassy or visa centre.`,
    no_admission: 'Entry is not currently allowed with this passport. Check the latest official advice before you book anything.',
    own_country: `${country} is your passport's country, so you do not need a visa.`,
    unknown: 'We do not have this combination yet. Check with the embassy before you travel.',
  }[entry];
  return { from, to, fromName: countryName(from), toName: country, entry, days, title: TITLES[entry], tone: TONES[entry], summary: rule?.summary ?? summary,
    notes: rule?.notes ?? [], apply: rule?.apply ?? null, checklist: template(entry, days, country, rule?.checklist),
    updated: rule && rule.since > data.updated ? rule.since : data.updated, source: rule?.sources?.length ? `${data.source}, with updates from official announcements and news reports` : data.source };
}

type Section = 'documents' | 'health' | 'money' | 'before';
/** The checklist a traveller starts with, written for their entry requirement. */
function template(entry: Entry, days: number | null, country: string, specific?: string[]): { section: Section; text: string }[] {
  const docs: string[] = [];
  if (entry === 'no_admission') return [{ section: 'documents', text: `Check the latest official advice on entering ${country} before you book` }];
  if (entry !== 'own_country') docs.push('Passport valid for at least 6 months after you return, with 2 blank pages');
  if (entry === 'visa_required') docs.push(`Apply for a ${country} visa at least 6 to 8 weeks before you fly`, 'Gather visa documents: bank statements, a letter from your employer or school, flight and hotel bookings, passport photos', 'Book and attend your visa appointment');
  if (entry === 'e_visa') docs.push(`Apply for the ${country} e-visa on the official government website (avoid agents who charge extra)`, 'Print your approved e-visa and keep a copy on your phone');
  // Destination-specific steps replace the general ones for the same visa type.
  if (specific?.length) docs.push(...specific);
  else {
    if (entry === 'eta') docs.push(`Get your ${country} electronic travel authorisation (ETA) before you fly`, 'Keep your ETA approval on your phone');
    if (days) docs.push(`Plan to stay no more than ${days} days`);
  }
  if (entry === 'visa_on_arrival') docs.push('Have the visa-on-arrival fee ready, often in cash (US dollars)');
  if (entry !== 'own_country') docs.push('Return or onward ticket', 'Proof of where you will stay: a hotel booking or an invitation letter', 'A recent bank statement showing you can pay for your stay');
  return [
    ...docs.map((text) => ({ section: 'documents' as const, text })),
    ...[`Check which vaccinations ${country} asks for, including a yellow fever certificate`, 'Travel insurance that covers medical care', 'Medicines in their original packs, with prescriptions'].map((text) => ({ section: 'health' as const, text })),
    ...['Turn on international payments on your bank card', `Some local cash or a travel card for ${country}`, 'Save towards the trip in your EveryCation wallet'].map((text) => ({ section: 'money' as const, text })),
    ...['Copies of your passport, visa and bookings on your phone and in your email', 'The right plug adapter', 'Offline maps downloaded', 'Your plans shared with someone at home', 'Online check-in done and flight times confirmed'].map((text) => ({ section: 'before' as const, text })),
  ];
}

const code = z.string().trim().length(2, 'Choose a country').transform((c) => c.toUpperCase()).refine((c) => index.has(c), 'Choose a country from the list');
const createBody = z.object({ from: code, to: code, tripId: z.uuid().optional() });
const itemBody = z.object({ text: z.string().trim().min(2, 'Write the item').max(120), section: z.enum(['documents', 'health', 'money', 'before']).default('before') });
const tickBody = z.object({ done: z.boolean() });

@Injectable()
export class TravelService {
  constructor(private readonly database: Database) {}
  private get db() { return this.database.db; }

  async list(userId: string) {
    const r = await this.db.execute(sql`SELECT c.id, c.passport, c.destination, c.trip_id, count(i.id)::int AS total, count(i.id) FILTER (WHERE i.done)::int AS done
      FROM travel_checklists c LEFT JOIN checklist_items i ON i.checklist_id = c.id WHERE c.user_id = ${userId} GROUP BY c.id ORDER BY c.created_at DESC`);
    return (r.rows as { id: string; passport: string; destination: string; trip_id: string | null; total: number; done: number }[])
      .map((c) => ({ id: c.id, passport: c.passport, destination: c.destination, destinationName: countryName(c.destination), tripId: c.trip_id, total: c.total, done: c.done }));
  }

  async get(userId: string, id: string) {
    const [c] = await this.db.select().from(travelChecklists).where(and(eq(travelChecklists.id, id), eq(travelChecklists.userId, userId)));
    if (!c) throw notFound('Checklist');
    const items = await this.db.select().from(checklistItems).where(eq(checklistItems.checklistId, id)).orderBy(asc(checklistItems.position), asc(checklistItems.createdAt));
    const req = requirements(c.passport, c.destination);
    return { id: c.id, passport: c.passport, destination: c.destination, destinationName: req.toName, passportName: req.fromName, tripId: c.tripId,
      requirement: { entry: req.entry, days: req.days, title: req.title, tone: req.tone, summary: req.summary },
      items: items.map((i) => ({ id: i.id, section: i.section, text: i.text, done: i.done, own: i.own })) };
  }

  /** One checklist per destination: asking again returns the one already made. */
  async create(userId: string, input: { from: string; to: string; tripId?: string }) {
    if (input.tripId) { const [t] = await this.db.select({ id: trips.id }).from(trips).where(and(eq(trips.id, input.tripId), eq(trips.userId, userId))); if (!t) throw notFound('Trip'); }
    const id = await this.db.transaction(async (tx) => {
      const [made] = await tx.insert(travelChecklists).values({ userId, passport: input.from, destination: input.to, tripId: input.tripId }).onConflictDoNothing().returning({ id: travelChecklists.id });
      if (!made) {
        const [had] = await tx.select({ id: travelChecklists.id, tripId: travelChecklists.tripId }).from(travelChecklists).where(and(eq(travelChecklists.userId, userId), eq(travelChecklists.destination, input.to)));
        if (input.tripId && !had!.tripId) await tx.update(travelChecklists).set({ tripId: input.tripId }).where(eq(travelChecklists.id, had!.id));
        return had!.id;
      }
      const items = requirements(input.from, input.to).checklist;
      if (items.length) await tx.insert(checklistItems).values(items.map((i, n) => ({ checklistId: made.id, section: i.section, text: i.text, position: n })));
      return made.id;
    });
    return this.get(userId, id);
  }

  private async owned(userId: string, id: string) {
    const [c] = await this.db.select({ id: travelChecklists.id }).from(travelChecklists).where(and(eq(travelChecklists.id, id), eq(travelChecklists.userId, userId)));
    if (!c) throw notFound('Checklist');
  }
  async tick(userId: string, id: string, itemId: string, done: boolean) {
    await this.owned(userId, id);
    const [i] = await this.db.update(checklistItems).set({ done }).where(and(eq(checklistItems.id, itemId), eq(checklistItems.checklistId, id))).returning({ id: checklistItems.id });
    if (!i) throw notFound('Item');
    return this.get(userId, id);
  }
  async addItem(userId: string, id: string, input: { text: string; section: string }) {
    await this.owned(userId, id);
    const [{ n }] = (await this.db.execute(sql`SELECT count(*)::int AS n FROM checklist_items WHERE checklist_id = ${id}`)).rows as [{ n: number }];
    if (n >= 100) throw badRequest('checklist_full', 'A checklist can hold up to 100 items.');
    await this.db.insert(checklistItems).values({ checklistId: id, section: input.section, text: input.text, own: true, position: 1000 + n });
    return this.get(userId, id);
  }
  async removeItem(userId: string, id: string, itemId: string) {
    await this.owned(userId, id);
    await this.db.delete(checklistItems).where(and(eq(checklistItems.id, itemId), eq(checklistItems.checklistId, id)));
    return this.get(userId, id);
  }
  async remove(userId: string, id: string) { await this.db.delete(travelChecklists).where(and(eq(travelChecklists.id, id), eq(travelChecklists.userId, userId))); }
}

@ApiTags('travel')
@Controller('travel')
class TravelController {
  constructor(private readonly travel: TravelService) {}
  @Public() @Get('countries') countries() { return COUNTRIES; }
  /** Entry requirements for a passport going to a destination, e.g. ?from=NG&to=GB. */
  @Public() @Get('requirements') requirements(@Query('from') from = '', @Query('to') to = '') {
    const f = from.toUpperCase(); const t = to.toUpperCase();
    if (!index.has(f) || !index.has(t)) throw badRequest('unknown_country', 'Choose your passport and destination from the list.');
    return requirements(f, t);
  }

  @ApiBearerAuth() @Get('checklists') list(@CurrentUser() u: AuthUser) { return this.travel.list(u.id); }
  @ApiBearerAuth() @Post('checklists') @HttpCode(200) create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(createBody)) b: z.infer<typeof createBody>) { return this.travel.create(u.id, b); }
  @ApiBearerAuth() @Get('checklists/:id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.travel.get(u.id, id); }
  @ApiBearerAuth() @Delete('checklists/:id') @HttpCode(204) async remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { await this.travel.remove(u.id, id); }
  @ApiBearerAuth() @Post('checklists/:id/items') @HttpCode(200) addItem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(itemBody)) b: z.infer<typeof itemBody>) { return this.travel.addItem(u.id, id, b); }
  @ApiBearerAuth() @Patch('checklists/:id/items/:itemId') tick(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body(new ZodPipe(tickBody)) b: z.infer<typeof tickBody>) { return this.travel.tick(u.id, id, itemId, b.done); }
  @ApiBearerAuth() @Delete('checklists/:id/items/:itemId') removeItem(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) { return this.travel.removeItem(u.id, id, itemId); }
}

@Module({ controllers: [TravelController], providers: [TravelService], exports: [TravelService] })
export class TravelModule {}
