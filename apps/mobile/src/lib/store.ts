import { create } from 'zustand';
import { naira, sample, type Advice, type BasketLine, type ItineraryItem, type Kobo } from '@everycation/shared';

type PlanMode = 'private' | 'free' | 'sell';
interface AppState {
  basket: BasketLine[];
  following: string[]; savedTips: string[]; bucket: string[]; likedComments: string[];
  myAdvice: Advice[]; extraItinerary: ItineraryItem[]; ownedPlans: string[];
  planListing: { mode: PlanMode; price: Kobo };
  readNotifications: boolean;
  setQty: (productId: string, qty: number) => void; addToBasket: (productId: string) => void; clearBasket: () => void;
  toggle: (list: 'following' | 'savedTips' | 'bucket' | 'likedComments', id: string) => void;
  submitAdvice: (a: Omit<Advice, 'id' | 'helpful' | 'status' | 'authorId'>) => void;
  addItinerary: (i: Omit<ItineraryItem, 'id'>) => void;
  buyPlan: (id: string) => void; listPlan: (mode: PlanMode, price: Kobo) => void; markAllRead: () => void;
}

/**
 * State for the parts of the app that still run on sample data (community, plans, shop, trips).
 * Sign-in lives in `session.ts` and the wallet in `wallet.ts`; both talk to the API.
 */
export const useApp = create<AppState>((set) => ({
  basket: sample.initialBasket,
  following: [], savedTips: [], bucket: [], likedComments: [], myAdvice: [], extraItinerary: [], ownedPlans: [],
  planListing: { mode: 'sell', price: naira(6500) }, readNotifications: false,

  setQty: (productId, qty) => set((s) => ({ basket: qty <= 0 ? s.basket.filter((l) => l.productId !== productId) : s.basket.map((l) => l.productId === productId ? { ...l, qty } : l) })),
  addToBasket: (productId) => set((s) => ({ basket: s.basket.some((l) => l.productId === productId) ? s.basket.map((l) => l.productId === productId ? { ...l, qty: l.qty + 1 } : l) : [...s.basket, { productId, qty: 1 }] })),
  clearBasket: () => set({ basket: [] }),
  toggle: (list, id) => set((s) => ({ [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id] })),
  submitAdvice: (a) => set((s) => ({ myAdvice: [{ ...a, id: `my-${Date.now()}`, helpful: 0, status: 'in_review', authorId: 'wole' }, ...s.myAdvice] })),
  addItinerary: (i) => set((s) => ({ extraItinerary: [...s.extraItinerary, { ...i, id: `x${Date.now()}` }] })),
  buyPlan: (id) => set((s) => ({ ownedPlans: [...s.ownedPlans, id] })),
  listPlan: (mode, price) => set({ planListing: { mode, price } }),
  markAllRead: () => set({ readNotifications: true }),
}));

export const basketCount = (b: BasketLine[]) => b.reduce((n, l) => n + l.qty, 0);
