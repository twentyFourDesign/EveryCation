import { naira } from '../money';
import type * as T from '../types';

export const me: T.Traveller = {
  id: 'wole', name: 'Oluwole Olarewaju', initials: 'WO', handle: '@wole', city: 'Lagos, Nigeria',
  bio: 'Weekend planner, mountain chaser. Collecting sunrises one trip at a time.',
  countries: 3, tips: 9, followers: '128', following: 74,
};

export const travellers: T.Traveller[] = [
  me,
  { id: 'amaka', name: 'Amaka O.', initials: 'AO', handle: '@amaka.travels', city: 'Abuja', badge: 'Top contributor · Bali',
    bio: 'Temple mornings, street food nights. I post the tips I wish someone had told me.', countries: 14, tips: 32, followers: '1.2k' },
  { id: 'tunde', name: 'Tunde A.', initials: 'TA', handle: '@tunde.a', city: 'Lagos', bio: 'Slow travel, fast trains.', countries: 8, tips: 17, followers: '342' },
  { id: 'kemi', name: 'Kemi B.', initials: 'KB', handle: '@kemib', city: 'Lagos', bio: 'City breaks and visa paperwork, simplified.', countries: 6, tips: 12, followers: '210' },
];

export const tips: T.Tip[] = [
  { id: 'ulun-danu', title: 'Reach Ulun Danu before the tour buses', place: 'Bali, Indonesia', region: 'BALI, INDONESIA', category: 'Temples', image: 'bali-temple',
    authorId: 'amaka', visited: 'Visited March 2026', readMins: 3, likes: 48, comments: 12, video: '0:48',
    body: 'Go at opening time. The lake is still and you get the shrine on the water almost to yourself for the first half hour. By mid-morning the car park fills up.',
    goodToKnow: ['Cover your shoulders and knees; a sarong works.', 'It is cooler up in the hills than on the coast. Bring a layer.'] },
  { id: 'rain-shell', title: 'Pack a rain shell, even in July', place: 'South Iceland', region: 'ICELAND', category: 'Packing', image: 'waterfall',
    authorId: 'tunde', visited: 'Visited July 2025', readMins: 2, likes: 31, comments: 4,
    body: 'The weather turns in minutes near the waterfalls. A light shell that packs small saved every day of the trip.',
    goodToKnow: ['Waterproof your phone pouch too.', 'Layers beat one heavy jacket.'] },
  { id: 'vaporetto', title: 'Buy a vaporetto pass, not single tickets', place: 'Venice, Italy', region: 'VENICE, ITALY', category: 'Getting around', image: 'venice-canal',
    authorId: 'tunde', visited: 'Visited April 2026', readMins: 2, likes: 22, comments: 6,
    body: 'If you ride more than twice a day, a multi-day pass pays for itself.',
    goodToKnow: ['Validate the pass every time you board.'] },
  { id: 'early-boat', title: 'Take the early boat to Nusa Penida', place: 'Bali, Indonesia', region: 'BALI, INDONESIA', category: 'Getting there', image: 'lagoon-aerial',
    authorId: 'wole', visited: 'Visited March 2026', readMins: 2, likes: 20, comments: 3,
    body: 'The 07:00 fast boat from Sanur gets you to the viewpoints before the day-trip crowds arrive.',
    goodToKnow: ['Book the return seat at the same time.'] },
  { id: 'giza-sunrise', title: 'See the pyramids at gate opening', place: 'Giza, Egypt', region: 'EGYPT', category: 'Sights', image: 'giza-traveller',
    authorId: 'wole', visited: 'Visited November 2025', readMins: 2, likes: 14, comments: 2,
    body: 'Be at the gate for opening. It is cooler and the plateau is quiet for an hour.', goodToKnow: ['Carry small notes for the entry.'] },
  { id: 'quiet-cove', title: 'Find the quiet cove past the main beach', place: 'Nusa Penida, Indonesia', region: 'INDONESIA', category: 'Beaches', image: 'jungle-cove',
    authorId: 'amaka', visited: 'Visited March 2026', readMins: 2, likes: 18, comments: 1,
    body: 'Walk ten minutes past the main steps and the path drops to a cove most visitors miss.', goodToKnow: ['Wear proper shoes for the path.'] },
];

export const comments: T.Comment[] = [
  { id: 'c1', tipId: 'ulun-danu', authorId: 'tunde', when: '2h', likes: 5, body: 'Went last month and can confirm. By 9 the bridge was packed.' },
  { id: 'c2', tipId: 'ulun-danu', authorId: 'amaka', when: '1h', likes: 0, isAuthor: true, body: 'Thanks! Grab a coffee at the stalls by the gate while you wait for opening.' },
  { id: 'c3', tipId: 'ulun-danu', authorId: 'kemi', when: '1d', likes: 2, body: 'Is it this busy on weekdays too, or mainly weekends?' },
];

export const places: T.Place[] = [
  { id: 'bali', name: 'Bali', kind: 'ISLAND', country: 'Indonesia', countryCode: 'ID', image: 'bali-temple', photos: 12, tipCount: 18,
    summary: 'Temples on lakes, rice terraces, surf beaches and day trips to the Nusa islands.', bestTime: 'Apr – Oct', currency: 'Rupiah (IDR)',
    experiences: [{ title: 'Ulun Danu at sunrise', image: 'bali-temple', tipId: 'ulun-danu' }, { title: 'Nusa Penida coast', image: 'lagoon-aerial', tipId: 'early-boat' }, { title: 'Quiet coves', image: 'jungle-cove', tipId: 'quiet-cove' }] },
  { id: 'dolomites', name: 'Dolomites', kind: 'MOUNTAINS', country: 'Italy', countryCode: 'IT', image: 'alpine-lake', photos: 9, tipCount: 11,
    summary: 'Sharp limestone peaks, mirror lakes and mountain huts linked by well-marked trails.', bestTime: 'Jun – Sep, Dec – Mar', currency: 'Euro (EUR)',
    experiences: [{ title: 'Lago di Braies at sunrise', image: 'alpine-lake' }] },
  { id: 'venice', name: 'Venice', kind: 'CITY', country: 'Italy', countryCode: 'IT', image: 'venice-canal', photos: 14, tipCount: 23,
    summary: 'Canals, islands of glass and lace, and no cars at all.', bestTime: 'Apr – Jun, Sep – Oct', currency: 'Euro (EUR)',
    experiences: [{ title: 'Vaporetto along the Grand Canal', image: 'venice-canal', tipId: 'vaporetto' }] },
];

const COUNTRY_NAMES = 'AF:Afghanistan|AL:Albania|DZ:Algeria|AD:Andorra|AO:Angola|AG:Antigua and Barbuda|AR:Argentina|AM:Armenia|AU:Australia|AT:Austria|AZ:Azerbaijan|BS:Bahamas|BH:Bahrain|BD:Bangladesh|BB:Barbados|BY:Belarus|BE:Belgium|BZ:Belize|BJ:Benin|BT:Bhutan|BO:Bolivia|BA:Bosnia and Herzegovina|BW:Botswana|BR:Brazil|BN:Brunei|BG:Bulgaria|BF:Burkina Faso|BI:Burundi|CV:Cabo Verde|KH:Cambodia|CM:Cameroon|CA:Canada|CF:Central African Republic|TD:Chad|CL:Chile|CN:China|CO:Colombia|KM:Comoros|CG:Congo|CD:Congo (DRC)|CR:Costa Rica|CI:Côte d’Ivoire|HR:Croatia|CU:Cuba|CY:Cyprus|CZ:Czechia|DK:Denmark|DJ:Djibouti|DM:Dominica|DO:Dominican Republic|EC:Ecuador|EG:Egypt|SV:El Salvador|GQ:Equatorial Guinea|ER:Eritrea|EE:Estonia|SZ:Eswatini|ET:Ethiopia|FJ:Fiji|FI:Finland|FR:France|GA:Gabon|GM:Gambia|GE:Georgia|DE:Germany|GH:Ghana|GR:Greece|GD:Grenada|GT:Guatemala|GN:Guinea|GW:Guinea-Bissau|GY:Guyana|HT:Haiti|HN:Honduras|HU:Hungary|IS:Iceland|IN:India|ID:Indonesia|IR:Iran|IQ:Iraq|IE:Ireland|IL:Israel|IT:Italy|JM:Jamaica|JP:Japan|JO:Jordan|KZ:Kazakhstan|KE:Kenya|KI:Kiribati|KW:Kuwait|KG:Kyrgyzstan|LA:Laos|LV:Latvia|LB:Lebanon|LS:Lesotho|LR:Liberia|LY:Libya|LI:Liechtenstein|LT:Lithuania|LU:Luxembourg|MG:Madagascar|MW:Malawi|MY:Malaysia|MV:Maldives|ML:Mali|MT:Malta|MH:Marshall Islands|MR:Mauritania|MU:Mauritius|MX:Mexico|FM:Micronesia|MD:Moldova|MC:Monaco|MN:Mongolia|ME:Montenegro|MA:Morocco|MZ:Mozambique|MM:Myanmar|NA:Namibia|NR:Nauru|NP:Nepal|NL:Netherlands|NZ:New Zealand|NI:Nicaragua|NE:Niger|NG:Nigeria|KP:North Korea|MK:North Macedonia|NO:Norway|OM:Oman|PK:Pakistan|PW:Palau|PS:Palestine|PA:Panama|PG:Papua New Guinea|PY:Paraguay|PE:Peru|PH:Philippines|PL:Poland|PT:Portugal|QA:Qatar|RO:Romania|RU:Russia|RW:Rwanda|KN:Saint Kitts and Nevis|LC:Saint Lucia|VC:Saint Vincent and the Grenadines|WS:Samoa|SM:San Marino|ST:São Tomé and Príncipe|SA:Saudi Arabia|SN:Senegal|RS:Serbia|SC:Seychelles|SL:Sierra Leone|SG:Singapore|SK:Slovakia|SI:Slovenia|SB:Solomon Islands|SO:Somalia|ZA:South Africa|KR:South Korea|SS:South Sudan|ES:Spain|LK:Sri Lanka|SD:Sudan|SR:Suriname|SE:Sweden|CH:Switzerland|SY:Syria|TW:Taiwan|TJ:Tajikistan|TZ:Tanzania|TH:Thailand|TL:Timor-Leste|TG:Togo|TO:Tonga|TT:Trinidad and Tobago|TN:Tunisia|TR:Türkiye|TM:Turkmenistan|TV:Tuvalu|UG:Uganda|UA:Ukraine|AE:United Arab Emirates|GB:United Kingdom|US:United States|UY:Uruguay|UZ:Uzbekistan|VU:Vanuatu|VA:Vatican City|VE:Venezuela|VN:Vietnam|YE:Yemen|ZM:Zambia|ZW:Zimbabwe';

const known: Record<string, Partial<T.Country>> = {
  GB: { tips: 1240, verified: 980, popular: true, facts: '£ · plug G · 999', cities: ['London', 'Manchester', 'Edinburgh'] },
  GH: { tips: 860, verified: 702, popular: true, facts: 'GH₵ · plug G · 112', cities: ['Accra', 'Kumasi', 'Cape Coast'] },
  AE: { tips: 1050, verified: 811, popular: true, facts: 'AED · plug G · 999', cities: ['Dubai', 'Abu Dhabi'] },
  ID: { tips: 418, verified: 96, facts: 'Rp · plug C/F · 112', cities: ['Bali', 'Jakarta'] },
  IT: { tips: 390, verified: 204, facts: '€ · plug F/L · 112', cities: ['Venice', 'Rome', 'Cortina'] },
  IS: { tips: 120, verified: 61, facts: 'kr · plug F · 112', cities: ['Reykjavík', 'Vík'] },
  AL: { tips: 42 }, DZ: { tips: 31 }, AO: { tips: 27 },
};

/** Every country, A to Z. Sample tip counts are placeholders until the API supplies real ones. */
export const countries: T.Country[] = COUNTRY_NAMES.split('|').map((row, i) => {
  const [code, name] = row.split(':') as [string, string];
  const tips = known[code]?.tips ?? 8 + ((i * 37) % 90);
  return { code, name, tips, verified: known[code]?.verified ?? Math.round(tips * 0.6), ...known[code] };
});

export const adviceTopics = ['Entry & visa', 'Money', 'Getting around', 'Safety', 'Health', 'Local customs', 'SIM & data'];

export const advice: T.Advice[] = [
  { id: 'a1', countryCode: 'GB', city: 'London', topic: 'Entry & visa', authorId: 'kemi', visited: 'visited London, Aug 2026', helpful: 84, status: 'verified',
    body: 'Book your biometrics slot as soon as you submit online. In July the Lagos centre had no free dates for two weeks. Bring printed bank statements as well as the PDFs.' },
  { id: 'a2', countryCode: 'GB', city: 'Manchester', topic: 'Entry & visa', authorId: 'tunde', visited: 'visited Manchester, May 2026', helpful: 51, status: 'verified',
    body: 'At the border they asked for my hotel booking and return ticket. Keep both offline on your phone.' },
  { id: 'a3', countryCode: 'GB', city: 'London', topic: 'Getting around', authorId: 'amaka', visited: 'visited London, Jun 2026', helpful: 33, status: 'verified',
    body: 'Tap the same bank card in and out on the Tube and buses. The daily cap makes it cheaper than a paper travelcard.' },
  { id: 'a4', countryCode: 'GB', city: 'London', topic: 'Money', authorId: 'wole', visited: 'visited London, Feb 2026', helpful: 4, status: 'in_review',
    body: 'Most places are card only now. I did not need cash once in a week.' },
  { id: 'a5', countryCode: 'ID', city: 'Bali', topic: 'Local customs', authorId: 'amaka', visited: 'visited Bali, Mar 2026', helpful: 40, status: 'verified',
    body: 'Bring a sarong for temples; most rent them at the gate, but your own saves the queue.' },
  { id: 'a6', countryCode: 'GH', city: 'Accra', topic: 'Getting around', authorId: 'tunde', visited: 'visited Accra, Jan 2026', helpful: 27, status: 'verified',
    body: 'Use the ride apps from Kotoka. The taxi rank quotes about double.' },
  { id: 'a7', countryCode: 'IS', city: 'Reykjavík', topic: 'Money', authorId: 'wole', visited: 'visited Reykjavík, Jul 2025', helpful: 0, status: 'in_review',
    body: 'Almost everywhere took cards, even small cafés. I only needed cash once, for a farm stand.' },
];

export const plans: T.TripPlan[] = [
  { id: 'dolomites-7', title: '7 days in the Dolomites', authorId: 'amaka', image: 'alpine-lake', days: 7, stops: 24, price: naira(7500), rating: 4.8, reviews: 126, used: 410, sales: 410,
    status: 'on_sale', tripDone: 'Did this trip in Sep 2026', updated: 'updated Oct 2026', badge: 'Creator pick', includes: ['7 days', '24 stops, mapped', '₦ budget sheet'],
    preview: [{ day: 1, time: '14:00', text: 'Land in Venice, rental car to Cortina (about 2.5 hrs)' }, { day: 1, time: '19:30', text: 'Dinner at a family-run spot near the main street' }, { day: 2, text: 'Sunrise at the lake, then the three peaks loop' }] },
  { id: 'venice-3', title: '3 days in Venice on a budget', authorId: 'tunde', image: 'venice-canal', days: 3, stops: 11, price: 0, rating: 4.6, reviews: 58, used: 230, saved: 96,
    status: 'free', tripDone: 'Did this trip in Apr 2026', includes: ['3 days', '11 stops, mapped', '₦ budget sheet'],
    preview: [{ day: 1, time: '10:00', text: 'Vaporetto pass, then the Rialto market' }, { day: 1, time: '16:00', text: 'Free walking loop through Cannaregio' }, { day: 2, text: 'Murano and Burano on the same pass' }] },
  { id: 'iceland-7', title: 'Iceland ring road, 7 days', authorId: 'wole', image: 'waterfall', days: 7, stops: 19, price: naira(6000), rating: 4.9, reviews: 31, used: 31, sales: 14,
    status: 'on_sale', tripDone: 'Did this trip in Jul 2025', includes: ['7 days', '19 stops, mapped', '₦ budget sheet'],
    preview: [{ day: 1, time: '09:00', text: 'Pick up the car, Golden Circle clockwise' }, { day: 1, time: '18:00', text: 'Night in Vík' }, { day: 2, text: 'Glacier lagoon and the black beach' }] },
  { id: 'bali-10', title: 'Bali in 10 days', authorId: 'amaka', image: 'bali-temple', days: 10, stops: 28, price: naira(9000), rating: 4.7, reviews: 88, used: 260, sales: 260,
    status: 'on_sale', tripDone: 'Did this trip in Mar 2026', includes: ['10 days', '28 stops, mapped', '₦ budget sheet'],
    preview: [{ day: 1, time: '15:00', text: 'Arrive, settle in Ubud' }, { day: 2, text: 'Ulun Danu at opening, rice terraces after lunch' }] },
  { id: 'nusa-day', title: 'Nusa Penida in a day', authorId: 'wole', image: 'lagoon-aerial', days: 1, stops: 6, price: 0, saved: 120, shared: 34,
    status: 'free', tripDone: 'Did this trip in Mar 2026', includes: ['1 day', '6 stops, mapped'], preview: [{ day: 1, time: '07:00', text: 'Fast boat from Sanur' }] },
  { id: 'dolomites-mine', title: 'Dolomites trip', authorId: 'wole', image: 'alpine-lake', days: 7, stops: 22, price: naira(6500),
    status: 'scheduled', tripEnds: '2026-12-19', tripDone: 'Trip ends 19 Dec', includes: ['7 days', '22 stops, mapped', 'Budget and packing list'], preview: [] },
];

/** Creator studio, November: 14 sales, ₦84,000 gross, 25% fee ₦21,000, ₦63,000 to the seller. */
export const creatorEarnings = { month: 'November', sales: 14, gross: naira(84000), fee: naira(21000), net: naira(63000) };

export const trips: T.Trip[] = [
  { id: 'dolomites', title: 'Dolomites trip', place: 'Dolomites, Italy', image: 'alpine-lake', start: '2026-12-12', end: '2026-12-19', dates: 'Sat 12 – Sat 19 Dec',
    nights: 7, travellers: 2, status: 'upcoming', month: 'DECEMBER 2026', tipsRecorded: 0, daysAway: 34, goalId: 'g-dolomites', packed: [8, 14],
    days: ['Sat 12', 'Sun 13', 'Mon 14', 'Tue 15', 'Wed 16', 'Thu 17', 'Fri 18', 'Sat 19'],
    itinerary: [
      { id: 'i1', day: 'Sat 12', time: '14:00', title: 'Land in Venice', note: 'Collect the rental car at the airport' },
      { id: 'i2', day: 'Sat 12', time: '19:30', title: 'Check in, Cortina', note: 'Parking behind the hotel' },
      { id: 'i3', day: 'Sun 13', time: '07:30', title: 'Drive to Rifugio Auronzo', note: 'Toll road · leave early in winter' },
      { id: 'i4', day: 'Sun 13', time: '09:00', title: 'Tre Cime loop hike', note: 'About 10 km · check trail conditions' },
      { id: 'i5', day: 'Sun 13', time: '19:00', title: 'Dinner in Cortina', note: 'Booked for 2' },
      { id: 'i6', day: 'Mon 14', time: '06:30', title: 'Lago di Braies at sunrise', note: 'Lago di Braies, South Tyrol' },
    ] },
  { id: 'bali', title: 'Bali & Nusa Penida', place: 'Bali, Indonesia', image: 'lagoon-aerial', start: '2026-03-06', end: '2026-03-15', dates: '6 – 15 Mar 2026', nights: 9, travellers: 2, status: 'past', month: 'MARCH 2026', tipsRecorded: 3 },
  { id: 'cairo', title: 'Cairo & Giza', place: 'Cairo, Egypt', image: 'giza-traveller', start: '2025-11-10', end: '2025-11-15', dates: '10 – 15 Nov 2025', nights: 5, travellers: 1, status: 'past', month: 'NOVEMBER 2025', tipsRecorded: 2 },
  { id: 'iceland', title: 'Iceland ring road', place: 'Iceland', image: 'waterfall', start: '2025-07-04', end: '2025-07-11', dates: '4 – 11 Jul 2025', nights: 7, travellers: 2, status: 'past', month: 'JULY 2025', tipsRecorded: 4 },
];

export const bucketList: T.BucketItem[] = [
  { id: 'b1', title: 'Hike the Dolomites', image: 'alpine-lake', state: 'planned', label: 'Planned · Dec', savedPct: 62, goalId: 'g-dolomites' },
  { id: 'b2', title: 'Gondola in Venice', image: 'venice-canal', state: 'saving', label: 'Saving up', savedPct: 12, goalId: 'g-venice' },
  { id: 'b3', title: 'Swim a hidden cove', image: 'jungle-cove', state: 'dream', label: 'Dream' },
  { id: 'b4', title: "See Nusa Penida's coast", image: 'lagoon-aerial', state: 'done', label: 'Done · Mar 2026' },
  { id: 'b5', title: 'Stand at the pyramids', image: 'giza-traveller', state: 'done', label: 'Done · Nov 2025' },
  { id: 'b6', title: 'Chase waterfalls in Iceland', image: 'waterfall', state: 'done', label: 'Done · Jul 2025' },
];

export const calendarEvents: T.CalendarEvent[] = [
  { id: 'e1', day: 12, endDay: 19, title: 'Dolomites trip', detail: 'Sat 12 – Sat 19 Dec · 7 nights', kind: 'trip', href: '/trip/dolomites' },
  { id: 'e2', day: 4, title: 'Auto-save ₦25,000', detail: 'Every Friday into Dolomites trip', kind: 'save', href: '/wallet/goal/g-dolomites' },
  { id: 'e3', day: 9, title: 'Shop order arrives', detail: 'Wed 9 Dec · Dakota backpack', kind: 'order', href: '/shop/order' },
];

/** Wallet: ₦120,000 available + ₦725,000 in goals = ₦845,000. */
export const wallet: T.Wallet = {
  available: naira(120000), card: 'Visa •••• 4821', dailyLimit: naira(300000), kyc: 'verified', kycMethod: 'BVN',
  banks: [{ id: 'bk1', bank: 'GTBank', last4: '4821', holder: 'Oluwole O.', isDefault: true }],
  goals: [
    { id: 'g-dolomites', name: 'Dolomites trip', kind: 'trip', image: 'alpine-lake', saved: naira(500000), target: naira(800000), locked: true, by: '12 Dec 2026', daysLeft: 34,
      autoSave: { amount: naira(25000), every: 'every Friday', from: 'GTBank •••• 4821' } },
    { id: 'g-shopping', name: 'Travel shopping', kind: 'shopping', image: 'product-3', saved: naira(45000), target: naira(80000), locked: false },
    { id: 'g-venice', name: 'Venice someday', kind: 'trip', image: 'venice-canal', saved: naira(180000), target: naira(1500000), locked: false },
  ],
};

export const walletTxns: T.WalletTxn[] = [
  { id: 't1', group: 'TODAY', title: 'Withdrawal to GTBank', detail: 'Available balance · Processing', amount: -naira(50000), direction: 'out', type: 'withdrawal' },
  { id: 't2', group: 'THIS WEEK', title: 'Auto-save · Dolomites trip', detail: 'Fri 6 Nov · from GTBank', amount: naira(25000), direction: 'in', type: 'goal' },
  { id: 't3', group: 'THIS WEEK', title: 'Bank transfer in', detail: 'Wed 4 Nov · to available balance', amount: naira(100000), direction: 'in', type: 'deposit' },
  { id: 't4', group: 'THIS WEEK', title: 'Moved to Travel shopping', detail: 'Mon 2 Nov · from available balance', amount: naira(15000), direction: 'move', type: 'goal' },
  { id: 't5', group: 'OCTOBER', title: 'Auto-save · Dolomites trip', detail: 'Fri 30 Oct · from GTBank', amount: naira(25000), direction: 'in', type: 'goal' },
];

export const nigerianBanks = ['GTBank', 'Access Bank', 'First Bank', 'Zenith Bank', 'UBA', 'Kuda', 'Opay', 'Moniepoint'];

export const shopCategories = ['Luggage & suitcases', 'Backpacks & bags', 'Packing cubes & organisers', 'Toiletries & travel-size', 'Skincare & sun care', 'Adapters & power banks', 'eSIMs & data plans', 'Comfort & sleep', 'Passport & security', 'Health & first aid', 'Beach & outdoor', 'Clothing & rainwear', "Kids' travel", 'Picked by travellers'];

export const products: T.Product[] = [
  { id: 'toiletry-bag', name: 'Personal organizer toiletry bag', category: 'Packing cubes & organisers', price: naira(38500), image: 'product-0', variant: 'Black',
    description: 'Hangs from a hook, opens flat, and keeps liquids in a wipe-clean pocket.' },
  { id: 'serum', name: 'Anti-wrinkle hydrating serum', category: 'Skincare & sun care', price: naira(24000), image: 'product-1', variant: '30 ml',
    description: 'Cabin-size bottle for long, dry flights.' },
  { id: 'cup-holder', name: 'Riemot luggage cup holder', category: 'Luggage & suitcases', price: naira(16500), image: 'product-2', variant: 'Grey',
    description: 'Slides over your suitcase handle and holds two drinks and a phone.' },
  { id: 'dakota', name: 'Dakota backpack, medium', brand: 'Dagne Dover', category: 'Backpacks & bags', price: naira(95000), image: 'product-3', variant: 'Navy',
    description: 'Fits under an airline seat, with a padded laptop sleeve and a strap that slides over your suitcase handle.',
    pickedNote: 'Picked by travellers. Mentioned in 4 tips about carry-on packing.' },
];

export const initialBasket: T.BasketLine[] = [{ productId: 'dakota', qty: 1 }, { productId: 'cup-holder', qty: 1 }];

export const order = {
  status: 'ON ITS WAY', arrives: 'Wed 9 Dec', items: 2,
  steps: [
    { title: 'Order placed', detail: 'Fri 4 Dec · paid from Travel shopping goal', done: true },
    { title: 'Packed', detail: 'Mon 7 Dec', done: true },
    { title: 'Out for delivery', detail: 'Expected Wed 9 Dec', done: false, current: true },
    { title: 'Delivered', detail: '', done: false },
  ],
};

export const notifications: T.AppNotification[] = [
  { id: 'n1', group: 'Today', type: 'community', actor: 'tunde', text: 'Tunde A. replied to your tip "Take the early boat to Nusa Penida"', when: '2h', href: '/tip/early-boat/comments' },
  { id: 'n2', group: 'Today', type: 'wallet', text: 'Your Dolomites trip goal passed 60%. ₦300,000 to go.', when: '5h', href: '/wallet/goal/g-dolomites' },
  { id: 'n3', group: 'Today', type: 'trips', text: "Your Dolomites trip is 5 weeks away. Check Italy's entry rules for your passport.", when: '8h', href: '/advice/IT' },
  { id: 'n4', group: 'This week', type: 'community', actor: 'amaka', text: 'Amaka O. started following you', when: 'Thu', href: '/traveller/amaka', action: 'Follow back' },
  { id: 'n5', group: 'This week', type: 'wallet', text: 'Auto-save of ₦25,000 added to Dolomites trip', when: 'Fri', href: '/wallet/history' },
  { id: 'n6', group: 'This week', type: 'community', text: 'Your tip "Pack a rain shell" was saved by 20 travellers', when: 'Wed', href: '/profile' },
];
