import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module.js';
import { CONFIG, type Config } from '../config.js';
import { Database } from '../db/db.module.js';
import { admins, advice, comments, places, tips, users } from '../db/schema.js';
import { AdminAuthService } from '../modules/admin/admin-auth.js';
import { otpauthUrl, totpCode } from '../modules/admin/totp.js';

/**
 * Development data: a few travellers with tips, comments and advice, and one staff account.
 * Refuses to run in production. Safe to run twice.
 */
const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
if (app.get<Config>(CONFIG).NODE_ENV === 'production') { console.error('Seeding is for development only.'); process.exit(1); }
const db = app.get(Database).db;

const people = [
  { phone: '+2348090000034', name: 'Amaka O.', handle: 'amaka.travels', city: 'Abuja', bio: 'Temple mornings, street food nights. I post the tips I wish someone had told me.' },
  { phone: '+2348020007713', name: 'Tunde A.', handle: 'tunde.a', city: 'Lagos', bio: 'Slow travel, fast trains.' },
  { phone: '+2348050001190', name: 'Kemi B.', handle: 'kemib', city: 'Lagos', bio: 'City breaks and visa paperwork, simplified.' },
];
const [existing] = await db.select().from(users).where(eq(users.phone, people[0]!.phone));
if (!existing) {
  const [amaka, tunde, kemi] = await db.insert(users).values(people).returning({ id: users.id });
  const t = await db.insert(tips).values([
    { userId: amaka!.id, title: 'Reach Ulun Danu before the tour buses', place: 'Bali, Indonesia', countryCode: 'ID', category: 'Temples', format: 'video', imageKey: 'bali-temple', visited: 'March 2026', likeCount: 48,
      body: 'Go at opening time. The lake is still and you get the shrine on the water almost to yourself for the first half hour. By mid-morning the car park fills up.', goodToKnow: ['Cover your shoulders and knees; a sarong works.', 'It is cooler up in the hills than on the coast. Bring a layer.'] },
    { userId: tunde!.id, title: 'Pack a rain shell, even in July', place: 'South Iceland', countryCode: 'IS', category: 'Packing', imageKey: 'waterfall', visited: 'July 2025', likeCount: 31,
      body: 'The weather turns in minutes near the waterfalls. A light shell that packs small saved every day of the trip.', goodToKnow: ['Waterproof your phone pouch too.', 'Layers beat one heavy jacket.'] },
    { userId: tunde!.id, title: 'Buy a vaporetto pass, not single tickets', place: 'Venice, Italy', countryCode: 'IT', category: 'Getting around', imageKey: 'venice-canal', visited: 'April 2026', likeCount: 22,
      body: 'If you ride more than twice a day, a multi-day pass pays for itself.', goodToKnow: ['Validate the pass every time you board.'] },
    { userId: amaka!.id, title: 'Find the quiet cove past the main beach', place: 'Nusa Penida, Indonesia', countryCode: 'ID', category: 'Beaches', imageKey: 'jungle-cove', visited: 'March 2026', likeCount: 18,
      body: 'Walk ten minutes past the main steps and the path drops to a cove most visitors miss.', goodToKnow: ['Wear proper shoes for the path.'] },
    { userId: kemi!.id, title: 'See the pyramids at gate opening', place: 'Giza, Egypt', countryCode: 'EG', category: 'Sights', imageKey: 'giza-traveller', visited: 'November 2025', likeCount: 14,
      body: 'Be at the gate for opening. It is cooler and the plateau is quiet for an hour.', goodToKnow: ['Carry small notes for the entry.'] },
  ]).returning({ id: tips.id });
  await db.insert(comments).values([
    { tipId: t[0]!.id, userId: tunde!.id, body: 'Went last month and can confirm. By 9 the bridge was packed.' },
    { tipId: t[0]!.id, userId: amaka!.id, body: 'Thanks! Grab a coffee at the stalls by the gate while you wait for opening.' },
    { tipId: t[0]!.id, userId: kemi!.id, body: 'Is it this busy on weekdays too, or mainly weekends?' },
  ]);
  await db.update(tips).set({ commentCount: 3 }).where(eq(tips.id, t[0]!.id));
  const now = new Date();
  await db.insert(advice).values([
    { userId: kemi!.id, countryCode: 'GB', city: 'London', topic: 'Entry & visa', visited: 'Aug 2026', status: 'verified', reviewedAt: now, helpfulCount: 84, body: 'Book your biometrics slot as soon as you submit online. In July the Lagos centre had no free dates for two weeks. Bring printed bank statements as well as the PDFs.' },
    { userId: tunde!.id, countryCode: 'GB', city: 'Manchester', topic: 'Entry & visa', visited: 'May 2026', status: 'verified', reviewedAt: now, helpfulCount: 51, body: 'At the border they asked for my hotel booking and return ticket. Keep both offline on your phone.' },
    { userId: amaka!.id, countryCode: 'GB', city: 'London', topic: 'Getting around', visited: 'Jun 2026', status: 'verified', reviewedAt: now, helpfulCount: 33, body: 'Tap the same bank card in and out on the Tube and buses. The daily cap makes it cheaper than a paper travelcard.' },
    { userId: tunde!.id, countryCode: 'GH', city: 'Accra', topic: 'Getting around', visited: 'Jan 2026', status: 'verified', reviewedAt: now, helpfulCount: 27, body: 'Use the ride apps from Kotoka. The taxi rank quotes about double.' },
    { userId: amaka!.id, countryCode: 'ID', city: 'Bali', topic: 'Local customs', visited: 'Mar 2026', status: 'in_review', body: 'Bring a sarong for temples; most rent them at the gate, but your own saves the queue.' },
    { userId: tunde!.id, countryCode: 'IS', city: 'Reykjavík', topic: 'Money', visited: 'Jul 2025', status: 'in_review', body: 'Almost everywhere took cards, even small cafés. I only needed cash once, for a farm stand.' },
    { userId: kemi!.id, countryCode: 'AE', city: 'Dubai', topic: 'Money', status: 'in_review', body: 'Exchange at the mall rather than the airport, the rate was noticeably better when I went.' },
  ]);
  console.log('Added 3 travellers, 5 tips, 3 comments and 7 pieces of advice (3 waiting for review).');
} else console.log('Sample travellers already exist.');

await db.insert(places).values([
  { slug: 'bali', name: 'Bali', kind: 'Island', countryCode: 'ID', imageKey: 'bali-temple', bestTime: 'Apr – Oct', currency: 'Rupiah (IDR)', summary: 'Temples on lakes, rice terraces, surf beaches and day trips to the Nusa islands.' },
  { slug: 'dolomites', name: 'Dolomites', kind: 'Mountains', countryCode: 'IT', imageKey: 'alpine-lake', bestTime: 'Jun – Sep, Dec – Mar', currency: 'Euro (EUR)', summary: 'Sharp limestone peaks, mirror lakes and mountain huts linked by well-marked trails.' },
  { slug: 'venice', name: 'Venice', kind: 'City', countryCode: 'IT', imageKey: 'venice-canal', bestTime: 'Apr – Jun, Sep – Oct', currency: 'Euro (EUR)', summary: 'Canals, islands of glass and lace, and no cars at all.' },
  { slug: 'accra', name: 'Accra', kind: 'City', countryCode: 'GH', imageKey: 'lagoon-aerial', bestTime: 'Nov – Mar', currency: 'Cedi (GHS)', summary: 'Beach bars, markets, live music and a short flight from Lagos.' },
  { slug: 'iceland', name: 'Iceland', kind: 'Country', countryCode: 'IS', imageKey: 'waterfall', bestTime: 'Jun – Aug', currency: 'Króna (ISK)', summary: 'Waterfalls, glaciers and a ring road that links them all.' },
]).onConflictDoNothing();
console.log('Places are in place.');

const email = 'admin@everycation.app';
let [admin] = await db.select().from(admins).where(eq(admins.email, email));
if (!admin) { await app.get(AdminAuthService).createAdmin({ email, name: 'Funke A.', role: 'super_admin', password: 'everycation-dev' }); [admin] = await db.select().from(admins).where(eq(admins.email, email)); }
console.log(`\nStaff sign-in for development:\n  Email:    ${email}\n  Password: everycation-dev\n  Authenticator: ${otpauthUrl(email, admin!.totpSecret)}\n  Code right now: ${totpCode(admin!.totpSecret)}\n  For a fresh code later: pnpm --filter @everycation/api admin:code ${email}`);
await app.close();
