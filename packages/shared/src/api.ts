/**
 * The data layer both apps call. Today it returns sample data after a short delay.
 * When the NestJS API is ready, replace the bodies with calls from the client
 * generated from its OpenAPI document; screens and hooks do not change.
 */
import * as app from './mock/app';
import * as admin from './mock/admin';

const later = <V>(value: V, ms = 120): Promise<V> => new Promise((r) => setTimeout(() => r(value), ms));
const must = <V>(v: V | undefined, what: string): V => {
  if (v === undefined) throw new Error(`${what} not found`);
  return v;
};

export const api = {
  me: () => later(app.me),
  traveller: (id: string) => later(must(app.travellers.find((t) => t.id === id), 'Traveller')),
  tips: (q?: { authorId?: string }) => later(q?.authorId ? app.tips.filter((t) => t.authorId === q.authorId) : app.tips),
  tip: (id: string) => later(must(app.tips.find((t) => t.id === id), 'Tip')),
  comments: (tipId: string) => later(app.comments.filter((c) => c.tipId === tipId || tipId !== 'ulun-danu')),
  places: () => later(app.places),
  place: (id: string) => later(must(app.places.find((p) => p.id === id), 'Place')),
  countries: () => later(app.countries),
  country: (code: string) => later(must(app.countries.find((c) => c.code === code), 'Country')),
  advice: (countryCode: string) => later(app.advice.filter((a) => a.countryCode === countryCode)),
  plans: () => later(app.plans.filter((p) => p.status === 'on_sale' || p.status === 'free')),
  plan: (id: string) => later(must(app.plans.find((p) => p.id === id), 'Plan')),
  myPlans: () => later(app.plans.filter((p) => p.authorId === 'wole')),
  creatorEarnings: () => later(app.creatorEarnings),
  trips: () => later(app.trips),
  trip: (id: string) => later(must(app.trips.find((t) => t.id === id), 'Trip')),
  bucketList: () => later(app.bucketList),
  calendar: () => later(app.calendarEvents),
  wallet: () => later(app.wallet),
  walletHistory: () => later(app.walletTxns),
  products: () => later(app.products),
  product: (id: string) => later(must(app.products.find((p) => p.id === id), 'Product')),
  order: () => later(app.order),
  notifications: () => later(app.notifications),
  search: (term: string) => {
    const t = term.trim().toLowerCase();
    const hit = (s: string) => t.length > 0 && s.toLowerCase().includes(t);
    return later({
      places: app.places.filter((p) => hit(p.name) || hit(p.country)),
      tips: app.tips.filter((x) => hit(x.title) || hit(x.place)),
      countries: app.countries.filter((c) => hit(c.name) || app.places.some((p) => p.countryCode === c.code && hit(p.name))).slice(0, 5),
      travellers: app.travellers.filter((x) => hit(x.name) || app.tips.some((tip) => tip.authorId === x.id && hit(tip.place))),
    });
  },
  admin: {
    overview: () => later(admin.overview),
    adviceQueue: () => later(admin.adviceSubmissions),
    reports: () => later(admin.reports),
    users: () => later(admin.users),
    heldWithdrawals: () => later(admin.heldWithdrawals),
    ledger: () => later(admin.ledger),
    payouts: () => later(admin.payouts),
    plans: () => later(admin.adminPlans),
    products: () => later(admin.adminProducts),
    orders: () => later(admin.adminOrders),
  },
};
export type Api = typeof api;
