import { create } from 'zustand';
import { naira, sample, type BasketLine, type Advice, type Goal, type ItineraryItem, type Kobo, type WalletTxn } from '@everycation/shared';

type PlanMode = 'private' | 'free' | 'sell';
interface AppState {
  signedIn: boolean; phone: string;
  /** Wallet setup: identity check → PIN → bank. Sample user starts verified. */
  walletReady: boolean;
  available: Kobo; goals: Goal[]; txns: WalletTxn[]; lastWithdrawal: { amount: Kobo; source: string; ref: string; when: string } | null; frozen: boolean;
  basket: BasketLine[];
  following: string[]; savedTips: string[]; bucket: string[]; likedComments: string[];
  myAdvice: Advice[]; extraItinerary: ItineraryItem[]; ownedPlans: string[];
  planListing: { mode: PlanMode; price: Kobo };
  readNotifications: boolean;
  signIn: (phone: string) => void; signOut: () => void; finishWalletSetup: () => void;
  addMoney: (amount: Kobo, destination: string) => void;
  withdraw: (amount: Kobo, source: string) => void;
  createGoal: (g: Omit<Goal, 'id' | 'saved' | 'image'>) => string;
  toggleGoalLock: (id: string) => void; setFrozen: (v: boolean) => void;
  setQty: (productId: string, qty: number) => void; addToBasket: (productId: string) => void; clearBasket: () => void;
  payFromGoal: (goalId: string, amount: Kobo, title: string) => void;
  toggle: (list: 'following' | 'savedTips' | 'bucket' | 'likedComments', id: string) => void;
  submitAdvice: (a: Omit<Advice, 'id' | 'helpful' | 'status' | 'authorId'>) => void;
  addItinerary: (i: Omit<ItineraryItem, 'id'>) => void;
  buyPlan: (id: string) => void; listPlan: (mode: PlanMode, price: Kobo) => void; markAllRead: () => void;
}

const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const txn = (t: Omit<WalletTxn, 'id' | 'group'>): WalletTxn => ({ ...t, id: `t${Date.now()}`, group: 'TODAY' });

/**
 * App state that changes on the device. Sample values stand in for the API:
 * each action here becomes a mutation (POST) and the wallet fields move to server state.
 */
export const useApp = create<AppState>((set, get) => ({
  signedIn: true, phone: '803 123 4821', walletReady: true,
  available: sample.wallet.available, goals: sample.wallet.goals, txns: sample.walletTxns, lastWithdrawal: null, frozen: false,
  basket: sample.initialBasket,
  following: [], savedTips: [], bucket: [], likedComments: [], myAdvice: [], extraItinerary: [], ownedPlans: [],
  planListing: { mode: 'sell', price: naira(6500) }, readNotifications: false,

  signIn: (phone) => set({ signedIn: true, phone }),
  signOut: () => set({ signedIn: false }),
  finishWalletSetup: () => set({ walletReady: true }),
  addMoney: (amount, destination) => set((s) => destination === 'available'
    ? { available: s.available + amount, txns: [txn({ title: 'Bank transfer in', detail: `${today()} · to available balance`, amount, direction: 'in', type: 'deposit' }), ...s.txns] }
    : { goals: s.goals.map((g) => g.id === destination ? { ...g, saved: g.saved + amount } : g),
        txns: [txn({ title: `Added to ${s.goals.find((g) => g.id === destination)?.name}`, detail: `${today()} · bank transfer`, amount, direction: 'in', type: 'goal' }), ...s.txns] }),
  withdraw: (amount, source) => set((s) => ({
    available: source === 'available' ? s.available - amount : s.available,
    goals: s.goals.map((g) => g.id === source ? { ...g, saved: g.saved - amount } : g),
    lastWithdrawal: { amount, source: source === 'available' ? 'Available balance' : `${s.goals.find((g) => g.id === source)?.name} goal`, ref: `EC-WD-${String(Date.now()).slice(-5)}`, when: new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    txns: [txn({ title: 'Withdrawal to GTBank', detail: 'Processing', amount: -amount, direction: 'out', type: 'withdrawal' }), ...s.txns],
  })),
  createGoal: (g) => { const id = `g-${Date.now()}`; set((s) => ({ goals: [...s.goals, { ...g, id, saved: 0, image: g.kind === 'shopping' ? 'product-3' : 'jungle-cove' }] })); return id; },
  toggleGoalLock: (id) => set((s) => ({ goals: s.goals.map((g) => g.id === id ? { ...g, locked: !g.locked } : g) })),
  setFrozen: (frozen) => set({ frozen }),
  setQty: (productId, qty) => set((s) => ({ basket: qty <= 0 ? s.basket.filter((l) => l.productId !== productId) : s.basket.map((l) => l.productId === productId ? { ...l, qty } : l) })),
  addToBasket: (productId) => set((s) => ({ basket: s.basket.some((l) => l.productId === productId) ? s.basket.map((l) => l.productId === productId ? { ...l, qty: l.qty + 1 } : l) : [...s.basket, { productId, qty: 1 }] })),
  clearBasket: () => set({ basket: [] }),
  payFromGoal: (goalId, amount, title) => set((s) => ({ goals: s.goals.map((g) => g.id === goalId ? { ...g, saved: g.saved - amount } : g), txns: [txn({ title, detail: `${today()} · from ${s.goals.find((g) => g.id === goalId)?.name}`, amount: -amount, direction: 'out', type: 'goal' }), ...s.txns] })),
  toggle: (list, id) => set((s) => ({ [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id] })),
  submitAdvice: (a) => set((s) => ({ myAdvice: [{ ...a, id: `my-${Date.now()}`, helpful: 0, status: 'in_review', authorId: 'wole' }, ...s.myAdvice] })),
  addItinerary: (i) => set((s) => ({ extraItinerary: [...s.extraItinerary, { ...i, id: `x${Date.now()}` }] })),
  buyPlan: (id) => set((s) => ({ ownedPlans: [...s.ownedPlans, id] })),
  listPlan: (mode, price) => set({ planListing: { mode, price } }),
  markAllRead: () => set({ readNotifications: true }),
}));

export const basketCount = (b: BasketLine[]) => b.reduce((n, l) => n + l.qty, 0);
export const goalsTotal = (goals: Goal[]) => goals.reduce((n, g) => n + g.saved, 0);
export const _get = () => useApp.getState();
