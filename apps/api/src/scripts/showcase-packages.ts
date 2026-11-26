import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { and, eq, isNotNull } from 'drizzle-orm';
import { AppModule } from '../app.module.js';
import { Database } from '../db/db.module.js';
import { advertisers, travelPackages } from '../db/schema.js';

/**
 * Adds five showcase packages so people can see how sponsored packages look. Safe to run again: it updates them.
 * Prices are illustrative, and enquiries on them never contact anyone. Usage:
 *   node dist/scripts/showcase-packages.js           add or refresh them
 *   node dist/scripts/showcase-packages.js --pause   take them all off the app
 */
const k = (naira: number) => naira * 100;
const ADVERTISERS = {
  jara: { name: 'Jara Beach Resort', kind: 'hotel' },
  lufasi: { name: 'Lufasi Lodges', kind: 'hotel' },
  kora: { name: 'Kora Coast Travels (sample agency)', kind: 'agency' },
  sahara: { name: 'Sahara Bridge Tours (sample agency)', kind: 'tour_operator' },
  island: { name: 'Island Hop Holidays (sample agency)', kind: 'agency' },
} as const;

const PACKAGES: (Omit<typeof travelPackages.$inferInsert, 'advertiserId' | 'adStarts'> & { by: keyof typeof ADVERTISERS })[] = [
  {
    sampleKey: 'jara-weekend', by: 'jara', plan: 'spotlight', title: 'Jara Beach Weekend for Two', destination: 'Eleko, Lagos', countryCode: 'NG', lat: 6.4386, lng: 3.8702, nights: 2,
    price: k(675_000), priceNote: 'for two adults, Garden Room, taxes included', vibe: 'beach',
    summary: 'Two slow days on Museyo Beach in Eleko, an hour past Lekki. Wake up by the sea, eat from the beach grill and let the Lagos traffic become a rumour.',
    includes: ['Two nights in a Garden Room for two adults', 'Beach barbecue lunch with drinks and snacks', 'Use of the resort\'s beach and outdoor facilities', 'VAT and consumption tax'],
    excludes: ['Transport to Eleko', 'Loft Room upgrade (from ₦225,000 per adult a night)', 'Children (child and toddler rates apply)'],
    itinerary: [
      { day: 'Day 1', title: 'Check in and beach barbecue', detail: 'Arrive by midday, settle into your Garden Room, then lunch off the grill and the first sunset on Museyo Beach.' },
      { day: 'Day 2', title: 'A full day of nothing', detail: 'Beach, books, games and long lunches. Nothing on the schedule unless you want it.' },
      { day: 'Day 3', title: 'Breakfast and goodbye', detail: 'One last walk on the sand before check-out.' },
    ],
  },
  {
    sampleKey: 'lufasi-retreat', by: 'lufasi', plan: 'featured', title: 'Lufasi Nature Retreat', destination: 'Lekki, Lagos', countryCode: 'NG', lat: 6.4521, lng: 3.6093, nights: 1,
    price: k(180_000), priceNote: 'for two, garden-view dome suite', vibe: 'nature', travelFrom: '2027-01-02',
    summary: 'A night in a garden-view dome beside Lufasi Nature Park on the Lekki-Epe Expressway. Forest walks, an indoor pool and breakfast, twenty minutes from the city.',
    includes: ['One night in a garden-view dome suite for two', 'Full breakfast', 'Indoor pool', 'Walk through Lufasi Nature Park, a minute away'],
    excludes: ['Spa treatments (book at the lodge)', 'Lunch and dinner'],
    itinerary: [
      { day: 'Afternoon', title: 'Check in to your dome', detail: 'Settle in, then a swim in the indoor pool.' },
      { day: 'Evening', title: 'Quiet garden evening', detail: 'Dinner nearby or a picnic in the garden. Book a massage at the spa if you like.' },
      { day: 'Morning', title: 'Breakfast and a forest walk', detail: 'Breakfast from 8:30, then the trails of Lufasi Nature Park before check-out.' },
    ],
  },
  {
    sampleKey: 'zanzibar-escape', by: 'kora', plan: 'featured', title: 'Zanzibar Beach Escape', destination: 'Zanzibar, Tanzania', countryCode: 'TZ', lat: -5.7266, lng: 39.2987, nights: 5,
    price: k(1_850_000), priceNote: 'per person sharing, flights from Lagos included', vibe: 'beach', imageKey: 'jungle-cove',
    summary: 'White sand at Nungwi, spice farms and the alleys of Stone Town. Return flights from Lagos, a beach hotel with breakfast and dinner, and two guided tours.',
    includes: ['Return flights Lagos to Zanzibar (via Nairobi)', 'Five nights at a beach hotel in Nungwi, breakfast and dinner', 'Airport transfers', 'Stone Town and spice farm tour', 'Sunset dhow cruise'],
    excludes: ['Tanzania e-visa fee', 'Travel insurance', 'Lunches and drinks'],
    itinerary: [
      { day: 'Day 1', title: 'Fly to Zanzibar', detail: 'Lagos to Zanzibar via Nairobi, then transfer north to Nungwi.' },
      { day: 'Day 2', title: 'Beach day', detail: 'Swim at Nungwi beach, then a sunset dhow cruise.' },
      { day: 'Day 3', title: 'Stone Town and spices', detail: 'Guided walk through Stone Town, lunch, then a spice farm.' },
      { day: 'Days 4 to 5', title: 'Your own time', detail: 'Snorkelling at Mnemba, Kendwa Rocks or just the hammock.' },
      { day: 'Day 6', title: 'Fly home', detail: 'Transfer to the airport for the flight back to Lagos.' },
    ],
  },
  {
    sampleKey: 'cairo-pyramids', by: 'sahara', plan: 'listing', title: 'Cairo and the Pyramids', destination: 'Cairo, Egypt', countryCode: 'EG', lat: 30.0444, lng: 31.2357, nights: 5,
    price: k(1_900_000), priceNote: 'per person sharing, flights from Lagos included', vibe: 'culture', imageKey: 'giza-traveller',
    summary: 'Stand in front of the Great Pyramid, ride a felucca on the Nile and get lost in Khan el-Khalili. Flights, a central hotel, guided tours and visa support included.',
    includes: ['Return flights Lagos to Cairo', 'Five nights at a hotel in central Cairo with breakfast', 'Guided tour of Giza and the Sphinx', 'Egyptian Museum entry', 'Felucca ride on the Nile', 'Help with your Egypt visa application'],
    excludes: ['Egypt visa fee', 'Travel insurance', 'Tips for guides'],
    itinerary: [
      { day: 'Day 1', title: 'Arrive in Cairo', detail: 'Airport pick-up and check-in.' },
      { day: 'Day 2', title: 'Giza and the Sphinx', detail: 'A guided morning at the pyramids, with camel rides for those who want them.' },
      { day: 'Day 3', title: 'Museums and the Nile', detail: 'The Egyptian Museum, then a felucca ride at sunset.' },
      { day: 'Day 4', title: 'Old Cairo', detail: 'Coptic Cairo, the Citadel and the Khan el-Khalili bazaar.' },
      { day: 'Days 5 to 6', title: 'Free day and fly home', detail: 'Shopping or a spa, then the flight back to Lagos.' },
    ],
  },
  {
    sampleKey: 'bali-retreat', by: 'island', plan: 'listing', title: 'Bali Temples and Rice Terraces', destination: 'Ubud, Bali', countryCode: 'ID', lat: -8.5069, lng: 115.2625, nights: 6,
    price: k(2_950_000), priceNote: 'per person sharing, flights from Lagos included', vibe: 'culture', imageKey: 'bali-temple',
    summary: 'Six nights split between a private-pool villa in Ubud and the beach at Seminyak, with temples, rice terraces and a sunrise you will talk about for years.',
    includes: ['Return flights Lagos to Bali (one stop)', 'Three nights in an Ubud villa with a private pool', 'Three nights in Seminyak near the beach', 'Breakfast daily', 'Ubud temples and Tegallalang rice terraces tour', 'Airport transfers'],
    excludes: ['Indonesia e-visa fee', 'Bali tourist levy', 'Travel insurance'],
    itinerary: [
      { day: 'Day 1 to 2', title: 'Fly to Bali', detail: 'Lagos to Denpasar with one stop, then a transfer to Ubud.' },
      { day: 'Day 3', title: 'Temples and terraces', detail: 'Tegallalang rice terraces, a water temple and the Ubud market.' },
      { day: 'Day 4', title: 'Sunrise and slow afternoon', detail: 'An optional sunrise trip, then the villa pool.' },
      { day: 'Days 5 to 7', title: 'Seminyak beach', detail: 'Beach clubs, sunsets and seafood on the sand.' },
      { day: 'Day 8', title: 'Fly home', detail: 'Transfer to the airport.' },
    ],
  },
];

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const db = app.get(Database).db;
if (process.argv.includes('--pause')) {
  const r = await db.update(travelPackages).set({ status: 'paused' }).where(isNotNull(travelPackages.sampleKey)).returning({ id: travelPackages.id });
  console.log(`Paused ${r.length} showcase packages.`);
} else {
  const ids: Record<string, string> = {};
  for (const [key, a] of Object.entries(ADVERTISERS)) {
    const [had] = await db.select({ id: advertisers.id }).from(advertisers).where(and(eq(advertisers.name, a.name), eq(advertisers.sample, true)));
    ids[key] = had?.id ?? (await db.insert(advertisers).values({ ...a, sample: true }).returning({ id: advertisers.id }))[0]!.id;
  }
  const adStarts = new Date().toISOString().slice(0, 10);
  for (const { by, ...p } of PACKAGES) {
    const values = { ...p, advertiserId: ids[by]!, status: 'live', adStarts };
    await db.insert(travelPackages).values(values).onConflictDoUpdate({ target: travelPackages.sampleKey, set: { ...values, adStarts: undefined } });
  }
  console.log(`${PACKAGES.length} showcase packages are live. Prices are illustrative and enquiries on them never contact anyone.\nTake them down later with: node dist/scripts/showcase-packages.js --pause`);
}
await app.close();
