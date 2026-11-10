import type { Kobo } from './money';

export type ImageKey =
  | 'alpine-lake' | 'bali-temple' | 'giza-traveller' | 'jungle-cove' | 'lagoon-aerial'
  | 'venice-canal' | 'waterfall' | 'product-0' | 'product-1' | 'product-2' | 'product-3';

export interface Traveller {
  id: string; name: string; initials: string; handle: string; city: string; bio: string;
  countries: number; tips: number; followers: string; following?: number; badge?: string;
}
export interface Tip {
  id: string; title: string; place: string; region: string; category: string; image: ImageKey;
  authorId: string; visited: string; readMins: number; body: string; goodToKnow: string[];
  likes: number; comments: number; video?: string;
}
export interface Comment { id: string; tipId: string; authorId: string; when: string; body: string; likes: number; isAuthor?: boolean }
export interface Place {
  id: string; name: string; kind: string; country: string; countryCode: string; image: ImageKey;
  summary: string; bestTime: string; currency: string; photos: number; tipCount: number;
  experiences: { title: string; image: ImageKey; tipId?: string }[];
}
export interface Country { code: string; name: string; tips: number; verified: number; popular?: boolean; facts?: string; cities?: string[] }
export type AdviceStatus = 'verified' | 'in_review' | 'changes_requested' | 'rejected';
export interface Advice {
  id: string; countryCode: string; city: string; topic: string; authorId: string; visited: string;
  body: string; helpful: number; status: AdviceStatus;
}
export type PlanSaleStatus = 'on_sale' | 'scheduled' | 'free' | 'private' | 'paused';
export interface TripPlan {
  id: string; title: string; authorId: string; image: ImageKey; days: number; stops: number;
  price: Kobo; rating?: number; reviews?: number; used?: number; sales?: number; saved?: number; shared?: number;
  status: PlanSaleStatus; tripEnds?: string; tripDone: string; updated?: string; badge?: string;
  includes: string[]; preview: { day: number; time?: string; text: string }[];
}
export interface ItineraryItem { id: string; day: string; time: string; title: string; note: string }
export interface Trip {
  id: string; title: string; place: string; image: ImageKey; start: string; end: string; dates: string;
  nights: number; travellers: number; status: 'upcoming' | 'past'; month: string; tipsRecorded: number;
  daysAway?: number; goalId?: string; packed?: [number, number]; days?: string[]; itinerary?: ItineraryItem[];
}
export interface BucketItem { id: string; title: string; image: ImageKey; state: 'planned' | 'saving' | 'dream' | 'done'; label: string; savedPct?: number; goalId?: string }
export interface CalendarEvent { id: string; day: number; endDay?: number; title: string; detail: string; kind: 'trip' | 'save' | 'order'; href: string }
export interface Goal { id: string; name: string; kind: 'trip' | 'shopping' | 'package'; image: ImageKey; saved: Kobo; target: Kobo; locked: boolean; by?: string; daysLeft?: number; autoSave?: { amount: Kobo; every: string; from: string } }
export interface Bank { id: string; bank: string; last4: string; holder: string; isDefault: boolean }
export interface WalletTxn { id: string; group: string; title: string; detail: string; amount: Kobo; direction: 'in' | 'out' | 'move'; type: 'deposit' | 'withdrawal' | 'goal' }
export interface Wallet { available: Kobo; goals: Goal[]; banks: Bank[]; card: string; dailyLimit: Kobo; kyc: 'none' | 'verified'; kycMethod: 'BVN' | 'NIN' }
export interface Product { id: string; name: string; brand?: string; category: string; price: Kobo; image: ImageKey; variant: string; description: string; pickedNote?: string }
export interface BasketLine { productId: string; qty: number }
export interface AppNotification { id: string; group: 'Today' | 'This week'; type: 'community' | 'wallet' | 'trips'; actor?: string; text: string; when: string; href: string; action?: string }
