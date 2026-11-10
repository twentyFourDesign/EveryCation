import { naira as n } from '../money';

export type AdminRole = 'Super admin' | 'Moderator' | 'Finance' | 'Shop ops' | 'Support';
export const currentAdmin = { name: 'Funke A.', initials: 'FA', role: 'Super admin' as AdminRole, email: 'funke@everycation.app' };

export const overview = {
  date: 'Monday 9 November 2026',
  kpis: [
    { label: 'Monthly active users', value: '48,210', delta: 6.2 },
    { label: 'New sign-ups', value: '4,040', delta: 11.3 },
    { label: 'Wallet funds held', value: '₦412.6M', delta: 4.8 },
    { label: 'Plan fee revenue (25%)', value: '₦1.84M', note: 'from ₦7.36M plan sales' },
    { label: 'Shop sales', value: '₦9.70M', delta: -2.1 },
  ],
  attention: [
    { count: 42, label: 'Advice awaiting review', note: 'Oldest waiting 19 hours', href: '/advice' },
    { count: 17, label: 'Open reports', note: '3 marked high priority', href: '/reports' },
    { count: 8, label: 'Withdrawals on hold', note: '₦2.1M waiting for Finance', href: '/transactions' },
    { count: 5, label: 'ID checks failed', note: "Name didn't match BVN", href: '/users' },
    { count: 23, label: 'Orders to dispatch', note: '9 due before customers fly', href: '/orders' },
  ],
  signups: [
    { week: '14 Sep', value: 820 }, { week: '21 Sep', value: 860 }, { week: '28 Sep', value: 910 }, { week: '5 Oct', value: 880 },
    { week: '12 Oct', value: 960 }, { week: '19 Oct', value: 1010 }, { week: '26 Oct', value: 990 }, { week: '2 Nov', value: 1080 },
  ],
  flow: [
    { label: 'Deposits', millions: 96.4 }, { label: 'Auto-saves into goals', millions: 58.2 },
    { label: 'Withdrawals to banks', millions: 71.0 }, { label: 'Spent in app (shop, plans)', millions: 14.5 },
  ],
  activity: [
    { time: '22:41', admin: 'Tobi K. · Moderator', action: 'Approved and verified advice', item: '"Book your biometrics slot early" · UK' },
    { time: '22:18', admin: 'Ada E. · Finance', action: 'Held withdrawal for review', item: '₦480,000 · user #48211' },
    { time: '21:57', admin: 'Tobi K. · Moderator', action: 'Removed comment (spam)', item: 'On tip "Pack a rain shell"' },
    { time: '21:30', admin: 'Seyi O. · Shop ops', action: 'Marked 12 orders as shipped', item: 'Batch 2026-11-09-B' },
  ],
};

export type AdviceQueue = 'waiting' | 'changes' | 'rereview' | 'decided';
export interface AdviceSubmission {
  id: string; queue: AdviceQueue; country: string; place: string; topic: string; waiting: string; body: string; appliesTo: string;
  author: { name: string; initials: string; since: string; record: string }; evidence: string[]; evidenceLabel: string;
}
export const adviceQueueCounts: Record<AdviceQueue, number> = { waiting: 42, changes: 6, rereview: 4, decided: 0 };
export const adviceSubmissions: AdviceSubmission[] = [
  { id: 'A-77131', queue: 'waiting', country: 'Iceland', place: 'Reykjavík, Iceland', topic: 'Money', waiting: '19h', appliesTo: 'July 2025',
    body: 'Almost everywhere took cards, even small cafés. I only needed cash once, for a farm stand.',
    author: { name: 'Wole O.', initials: 'WO', since: 'Mar 2025', record: '9 tips · 7 approved advice · 0 removed · passport: Nigeria' },
    evidenceLabel: 'trip on timeline', evidence: ['Timeline trip: Iceland ring road, 4–11 July 2025', 'Location stamps: 38 photos in Iceland that week', 'In-app check-ins: Reykjavík, Vík'] },
  { id: 'A-77134', queue: 'waiting', country: 'United Kingdom', place: 'London, United Kingdom', topic: 'Entry & visa', waiting: '16h', appliesTo: 'Not stated',
    body: 'You can now pay the visa fee in naira at the centre, so there is no need for a dollar card.',
    author: { name: 'Sola P.', initials: 'SP', since: 'Oct 2026', record: '0 tips · 0 approved advice · 0 removed · passport: Nigeria' },
    evidenceLabel: 'No trip evidence attached', evidence: [] },
  { id: 'A-77140', queue: 'waiting', country: 'Ghana', place: 'Accra, Ghana', topic: 'Getting around', waiting: '11h', appliesTo: 'October 2026',
    body: 'Use the ride apps from Kotoka, the taxi rank quotes about double the app price.',
    author: { name: 'Ifeoma N.', initials: 'IN', since: 'Jan 2026', record: '5 tips · 3 approved advice · 0 removed · passport: Nigeria' },
    evidenceLabel: 'check-in in Accra', evidence: ['In-app check-in: Kotoka International Airport, 18 Oct 2026', 'Location stamps: 12 photos in Accra'] },
  { id: 'A-77152', queue: 'waiting', country: 'Indonesia', place: 'Bali, Indonesia', topic: 'Local customs', waiting: '6h', appliesTo: 'March 2026',
    body: 'Bring a sarong for temples; most rent them at the gate, but your own saves the queue.',
    author: { name: 'Amaka O.', initials: 'AO', since: 'Nov 2024', record: '32 tips · 28 approved advice · 0 removed · passport: Nigeria' },
    evidenceLabel: 'trip on timeline', evidence: ['Timeline trip: Bali, 2–12 March 2026', 'Location stamps: 64 photos in Bali'] },
  { id: 'A-76990', queue: 'changes', country: 'United Arab Emirates', place: 'Dubai, UAE', topic: 'Money', waiting: '2d', appliesTo: 'Not stated',
    body: 'Exchange at the mall, the rate is better.', author: { name: 'Halima S.', initials: 'HS', since: 'Jun 2025', record: '4 tips · 2 approved advice · 0 removed · passport: Nigeria' },
    evidenceLabel: 'trip on timeline', evidence: ['Timeline trip: Dubai, 1–6 Sep 2026'] },
  { id: 'A-70412', queue: 'rereview', country: 'United Kingdom', place: 'London, United Kingdom', topic: 'Entry & visa', waiting: '8h', appliesTo: 'January 2025',
    body: 'No bank statement needed for a visit visa.', author: { name: 'Chidi E.', initials: 'CE', since: 'Feb 2025', record: '6 tips · 4 approved advice · 0 removed · passport: Nigeria' },
    evidenceLabel: '3 reports: out of date', evidence: ['Timeline trip: London, 10–20 Jan 2025', 'Reported 3 times as out of date'] },
];
export const reviewChecklist = ['First-hand: matches a real visit', 'Not misleading or out of date', 'No advertising, links or personal data', 'Safe and legal to follow'];

export interface Report { id: string; priority: 'High' | 'Normal'; type: string; item: string; reason: string; reports: number; opened: string; assigned: string | null }
export const reports: Report[] = [
  { id: 'R-1', priority: 'High', type: 'Trip plans', item: 'Trip plan · "Lagos to Dubai on ₦0 visa"', reason: 'Scam or false claims', reports: 9, opened: '2h ago', assigned: 'Tobi K.' },
  { id: 'R-2', priority: 'High', type: 'Comments', item: 'Comment on "Reach Ulun Danu early"', reason: 'Harassment', reports: 4, opened: '3h ago', assigned: null },
  { id: 'R-3', priority: 'High', type: 'Profiles', item: 'Profile · @cheap.visas.ng', reason: 'Selling services', reports: 6, opened: '5h ago', assigned: null },
  { id: 'R-4', priority: 'Normal', type: 'Advice', item: 'Advice · UK · "No bank statement needed"', reason: 'Out of date', reports: 3, opened: '8h ago', assigned: 'Tobi K.' },
  { id: 'R-5', priority: 'Normal', type: 'Tips', item: 'Tip · "Best beach bars in Accra"', reason: 'Spam links', reports: 2, opened: '1d ago', assigned: null },
  { id: 'R-6', priority: 'Normal', type: 'Comments', item: 'Comment on "Buy a vaporetto pass"', reason: 'Off-topic', reports: 1, opened: '1d ago', assigned: null },
];
export const reportDetail = {
  title: 'Lagos to Dubai on ₦0 visa', by: '@cheap.visas.ng · ₦15,000 · 3 sales', dates: 'Trip ended 2 Nov · on sale since 3 Nov',
  quote: "Plan says you don't need a visa. That's false and the 'agent' in it asks for payment on WhatsApp.", similar: 8,
  decisions: ['Remove plan and refund 3 buyers', 'Remove plan, no refund', 'Keep plan'],
};

export interface AdminUser { id: string; name: string; phone: string; joined: string; kyc: 'Failed' | 'BVN · verified' | 'NIN · verified' | 'Not started'; wallet: number | null; plansSold: number; status: 'Active' | 'Suspended' }
export const users: AdminUser[] = [
  { id: '30518', name: 'Kemi B.', phone: '+234 805 ••• 1190', joined: 'Feb 2025', kyc: 'Failed', wallet: 0, plansSold: 0, status: 'Active' },
  { id: '10442', name: 'Wole O.', phone: '+234 803 ••• 4821', joined: 'Mar 2025', kyc: 'BVN · verified', wallet: n(845000), plansSold: 14, status: 'Active' },
  { id: '8812', name: 'Amaka O.', phone: '+234 809 ••• 0034', joined: 'Nov 2024', kyc: 'NIN · verified', wallet: n(1240500), plansSold: 210, status: 'Active' },
  { id: '52003', name: '@cheap.visas.ng', phone: '+234 701 ••• 5521', joined: 'Oct 2026', kyc: 'BVN · verified', wallet: n(33750), plansSold: 3, status: 'Suspended' },
  { id: '21907', name: 'Tunde A.', phone: '+234 802 ••• 7713', joined: 'Jun 2025', kyc: 'Not started', wallet: null, plansSold: 0, status: 'Active' },
];
export const userFilters = ['All', 'ID check failed · 5', 'Selling plans · 1,212', 'Suspended · 31', 'Wallet frozen · 9'];
export const userDetail = {
  initials: 'KB', name: 'Kemi B.', line: '#30518 · kemi.b@mail.com · Lagos', kycTitle: 'ID check failed · 2 attempts',
  kycRows: [['BVN name', 'OLUWAKEMI BELLO'], ['Account name', 'Kemi Bello']], kycNote: 'Date of birth matches. First name differs.',
  facts: [['Trips on timeline', '4'], ['Advice posted', '12 · 11 verified'], ['Reports against', '0'], ['Last active', 'Today, 21:04']],
};

export const walletTotals = [
  { label: 'Total held', value: '₦412.6M' }, { label: 'Available balances', value: '₦118.4M' },
  { label: 'In savings goals', value: '₦294.2M', note: '₦186.9M locked' }, { label: 'Withdrawals on hold', value: '8 · ₦2.1M', alert: true },
];
export const heldWithdrawals = [
  { id: 'h1', user: '#48211 Chidi E.', amount: n(480000), to: 'Access •••• 9031', isNew: false, why: 'Over daily limit', waiting: '2h' },
  { id: 'h2', user: '#52003 @cheap.visas.ng', amount: n(33750), to: 'Opay •••• 1180', isNew: false, why: 'Account under report', waiting: '5h' },
  { id: 'h3', user: '#39977 Halima S.', amount: n(250000), to: 'Kuda •••• 6625', isNew: true, why: 'Bank added today', waiting: '7h' },
];
export type LedgerKind = 'Deposits' | 'Withdrawals' | 'Purchases' | 'Payouts & fees';
export const ledger: { time: string; ref: string; user: string; type: string; amount: number; status: string; kind: LedgerKind }[] = [
  { time: '22:47', ref: 'EC-WD-90412', user: '#10442 Wole O.', type: 'Withdrawal to GTBank', amount: -n(50000), status: 'Processing', kind: 'Withdrawals' },
  { time: '22:31', ref: 'EC-PL-55120', user: '#61002 Zainab M.', type: 'Trip plan purchase · 7 days in the Dolomites', amount: -n(7500), status: 'Completed', kind: 'Purchases' },
  { time: '22:31', ref: 'EC-FEE-55120', user: 'Platform', type: 'Platform fee 25% on EC-PL-55120', amount: n(1875), status: 'Completed', kind: 'Payouts & fees' },
  { time: '22:05', ref: 'EC-DP-77314', user: '#30518 Kemi B.', type: 'Bank transfer in', amount: n(100000), status: 'Completed', kind: 'Deposits' },
  { time: '21:44', ref: 'EC-SH-20981', user: '#8812 Amaka O.', type: 'Shop order · goal + card', amount: -n(111500), status: 'Completed', kind: 'Purchases' },
];

/** Friday batch. Gross ₦432,000 → fee ₦108,000 → ₦324,000 owed, of which ₦51,750 is held and ₦272,250 is paid. */
export const payoutBatch = { date: 'Friday 13 November', window: 'sales from 6 to 12 November' };
export const payouts: { seller: string; id: string; sales: number; gross: number; held?: string }[] = [
  { seller: 'Amaka O.', id: '8812', sales: 40, gross: n(300000) },
  { seller: 'Ifeoma N.', id: '44120', sales: 9, gross: n(45000) },
  { seller: 'Wole O.', id: '10442', sales: 3, gross: n(18000) },
  { seller: 'Kemi B.', id: '30518', sales: 6, gross: n(24000), held: 'ID check failed' },
  { seller: '@cheap.visas.ng', id: '52003', sales: 3, gross: n(45000), held: 'under report' },
];
export const payoutRules = [
  ['25% platform fee', 'Taken from every plan sale at checkout. Sellers receive 75%.'],
  ['Paid every Friday', "Into the seller's wallet available balance, after Finance approves the batch."],
  ['Verified ID needed', 'Earnings wait in the batch until the seller passes the BVN or NIN check.'],
  ['Refunds come out first', 'If a plan is removed after a report, buyers are refunded before any payout.'],
];

export type AdminPlanStatus = 'On sale' | 'Waiting' | 'Free' | 'Paused · report' | 'Removed';
export const adminPlans: { id: string; title: string; seller: string; price: number; tripEnds: string; ended: boolean; status: AdminPlanStatus; opens?: string; sales: number | null; rating: number | null; reports: number; image: string }[] = [
  { id: 'p1', title: '7 days in the Dolomites', seller: 'Amaka O.', price: n(7500), tripEnds: 'Sep 2026', ended: true, status: 'On sale', sales: 410, rating: 4.8, reports: 0, image: 'alpine-lake' },
  { id: 'p2', title: 'Dolomites trip', seller: 'Wole O.', price: n(6500), tripEnds: '19 Dec 2026', ended: false, status: 'Waiting', opens: 'Opens 20 Dec', sales: null, rating: null, reports: 0, image: 'alpine-lake' },
  { id: 'p3', title: 'Iceland ring road, 7 days', seller: 'Wole O.', price: n(6000), tripEnds: 'Jul 2025', ended: true, status: 'On sale', sales: 31, rating: 4.9, reports: 0, image: 'waterfall' },
  { id: 'p4', title: '3 days in Venice on a budget', seller: 'Tunde A.', price: 0, tripEnds: 'Apr 2026', ended: true, status: 'Free', sales: null, rating: 4.6, reports: 0, image: 'venice-canal' },
  { id: 'p5', title: 'Lagos to Dubai on ₦0 visa', seller: '@cheap.visas.ng', price: n(15000), tripEnds: '2 Nov 2026', ended: true, status: 'Paused · report', sales: 3, rating: 1.3, reports: 9, image: 'giza-traveller' },
];
export const planFilters = ['All', 'On sale · 1,874', 'Waiting for trip to end · 263', 'Free · 1,240', 'Removed · 41'];

export const productCategories: [string, number | 'curated'][] = [
  ['Luggage & suitcases', 48], ['Backpacks & bags', 61], ['Packing cubes & organisers', 27], ['Toiletries & travel-size', 54], ['Skincare & sun care', 39],
  ['Adapters & power banks', 33], ['eSIMs & data plans', 22], ['Comfort & sleep', 25], ['Passport & security', 31], ['Health & first aid', 29],
  ['Beach & outdoor', 44], ['Clothing & rainwear', 41], ["Kids' travel", 32], ['Picked by travellers', 'curated'],
];
export const adminProducts: { id: string; name: string; category: string; price: number; stock: number | 'Digital'; sold: number; status: 'Live' | 'Hidden · sold out'; image?: string }[] = [
  { id: 'sku1', name: 'Dagne Dover Dakota backpack, M', category: 'Backpacks & bags', price: n(95000), stock: 34, sold: 58, status: 'Live', image: 'product-3' },
  { id: 'sku2', name: 'Personal organizer toiletry bag', category: 'Packing cubes & organisers', price: n(38500), stock: 120, sold: 143, status: 'Live', image: 'product-0' },
  { id: 'sku3', name: 'Riemot luggage cup holder', category: 'Luggage & suitcases', price: n(16500), stock: 6, sold: 71, status: 'Live', image: 'product-2' },
  { id: 'sku4', name: 'Universal travel adapter, 4 USB', category: 'Adapters & power banks', price: n(12000), stock: 210, sold: 96, status: 'Live' },
  { id: 'sku5', name: 'Europe eSIM, 10 GB / 30 days', category: 'eSIMs & data plans', price: n(18000), stock: 'Digital', sold: 212, status: 'Live' },
  { id: 'sku6', name: 'Anti-wrinkle hydrating serum', category: 'Skincare & sun care', price: n(24000), stock: 0, sold: 38, status: 'Hidden · sold out', image: 'product-1' },
];

export const orderPipeline = [
  { label: 'To dispatch', count: 23 }, { label: 'Shipped', count: 41 }, { label: 'Out for delivery', count: 17 },
  { label: 'Delivered (30d)', count: 306 }, { label: 'Returns to process', count: 4, alert: true },
];
export const adminOrders: { id: string; customer: string; items: number; total: number; paidWith: string; deliverBy: string; urgent: boolean; status: string }[] = [
  { id: 'EC-SH-20981', customer: 'Amaka O. · Lekki, Lagos', items: 2, total: n(111500), paidWith: 'Goal ₦45,000 + card', deliverBy: 'Wed 9 Dec · flies 12 Dec', urgent: true, status: 'To dispatch' },
  { id: 'EC-SH-20977', customer: 'Halima S. · Wuse, Abuja', items: 1, total: n(12000), paidWith: 'Wallet', deliverBy: 'Fri 13 Nov · flies 15 Nov', urgent: true, status: 'To dispatch' },
  { id: 'EC-SH-20970', customer: 'Chidi E. · GRA, Port Harcourt', items: 3, total: n(70000), paidWith: 'Card', deliverBy: 'Mon 16 Nov', urgent: false, status: 'To dispatch' },
  { id: 'EC-SH-20944', customer: 'Zainab M. · Ikeja, Lagos', items: 1, total: n(18000), paidWith: 'Wallet', deliverBy: 'Delivered by email', urgent: false, status: 'eSIM sent' },
  { id: 'EC-SH-20912', customer: 'Tunde A. · Yaba, Lagos', items: 1, total: n(38500), paidWith: 'Card', deliverBy: 'Tue 10 Nov', urgent: false, status: 'Out for delivery' },
];

export const featuredSlots = [
  { slot: 'SLOT 1 · TIP', title: 'Reach Ulun Danu before the tour buses', image: 'bali-temple' },
  { slot: 'SLOT 2 · TIP', title: 'Pack a rain shell, even in July', image: 'waterfall' },
  { slot: 'TRIP PLAN OF THE WEEK', title: '7 days in the Dolomites · Amaka O.', image: 'alpine-lake' },
];
export const adminPlaces = [
  { name: 'Bali', country: 'Indonesia', tips: 418, verified: 96, photos: 1240, status: 'Published' },
  { name: 'London', country: 'United Kingdom', tips: 702, verified: 388, photos: 2105, status: 'Published' },
  { name: 'Accra', country: 'Ghana', tips: 355, verified: 140, photos: 860, status: 'Published' },
  { name: 'Zanzibar', country: 'Tanzania', tips: 24, verified: 3, photos: 61, status: 'Draft · needs cover photo' },
];

export const audiences = ['Travellers with a trip in December · 6,214', 'Everyone · 61,480', 'Sellers with a plan opening this week · 41', 'Wallet users with no goal yet · 9,870'];
export const broadcastTargets = ['Shop · Picked by travellers', 'Explore', 'Wallet'];
export const sentBroadcasts = [
  { sent: '2 Nov', title: 'Your savings goal can pay for the shop', audience: 'Wallet users with a shopping goal', delivered: 3102, opened: 22 },
  { sent: '27 Oct', title: 'Share what you learned on your trip', audience: 'Trips ended in October', delivered: 4880, opened: 31 },
  { sent: '20 Oct', title: 'Sell your trip plan, keep 75%', audience: 'Travellers with 2+ past trips', delivered: 12450, opened: 18 },
];

export const staff: { name: string; role: AdminRole; lastActive: string }[] = [
  { name: 'Funke A.', role: 'Super admin', lastActive: 'Now' }, { name: 'Tobi K.', role: 'Moderator', lastActive: '3 min ago' },
  { name: 'Grace U.', role: 'Moderator', lastActive: '2h ago' }, { name: 'Ada E.', role: 'Finance', lastActive: '25 min ago' },
  { name: 'Seyi O.', role: 'Shop ops', lastActive: '1h ago' }, { name: 'Musa D.', role: 'Support', lastActive: 'Yesterday' },
  { name: 'Bisi L.', role: 'Support', lastActive: 'Invited · pending' },
];
export const roles: AdminRole[] = ['Super admin', 'Moderator', 'Finance', 'Shop ops', 'Support'];
export type Access = 'Edit' | 'View' | 'Approve' | null;
/** Rows follow the order of `roles`. The same table drives the sidebar and page guards. */
export const permissions: { area: string; key: string; access: Access[] }[] = [
  { area: 'Advice, reports, content', key: 'moderation', access: ['Edit', 'Edit', null, null, 'View'] },
  { area: 'Users & ID checks', key: 'users', access: ['Edit', 'View', 'View', null, 'Edit'] },
  { area: 'Wallet & withdrawals', key: 'wallet', access: ['Edit', null, 'Edit', null, 'View'] },
  { area: 'Creator payouts', key: 'payouts', access: ['Approve', null, 'Approve', null, null] },
  { area: 'Trip plans', key: 'plans', access: ['Edit', 'Edit', 'View', null, 'View'] },
  { area: 'Shop products & orders', key: 'shop', access: ['Edit', null, 'View', 'Edit', 'View'] },
  { area: 'Notifications', key: 'broadcasts', access: ['Edit', 'View', null, 'Edit', null] },
  { area: 'Settings & fees', key: 'settings', access: ['Edit', null, 'View', null, null] },
];
export const auditLog = [
  { when: '9 Nov, 22:41', admin: 'Tobi K.', action: 'Approved and verified advice', item: 'Advice #A-77120 · UK', from: 'Lagos · Chrome' },
  { when: '9 Nov, 22:18', admin: 'Ada E.', action: 'Held withdrawal', item: 'EC-WD-90388 · ₦480,000', from: 'Lagos · Safari' },
  { when: '9 Nov, 20:02', admin: 'Funke A.', action: 'Suspended seller, froze wallet', item: 'User #52003', from: 'Lagos · Chrome' },
  { when: '8 Nov, 16:45', admin: 'Funke A.', action: 'Changed withdrawal daily limit', item: '₦250,000 → ₦300,000', from: 'Abuja · Chrome' },
];

export const platformSettings = {
  feePercent: 25, salesAfterTripEnds: true, sellersNeedId: true, payoutDay: 'Every Friday',
  hideUnreviewed: true, reportsToRereview: 3, dailyLimit: '₦300,000', holdNewBank: true, soonDays: '7 days',
};
