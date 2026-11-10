import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Author } from './community';
import { queryClient } from './query';
import { useSession } from './session';

export interface Plan {
  id: string; tripId: string; title: string; place: string; countryCode: string; imageKey: string | null; summary: string; days: number; stops: number; price: number;
  status: 'private' | 'free' | 'on_sale' | 'scheduled'; opensAt: string | null; tripEnded: boolean; tripEndDate: string; used: number; author: Author; mine: boolean; owned: boolean;
}
export interface PlanDetail extends Plan { unlocked: boolean; lockedStops: number; itinerary: { day: number; time: string; title: string; note: string }[] }
export interface Studio { month: { sales: number; gross: number; fee: number; net: number }; waitingForPayout: number; canBePaid: boolean; feePercent: number; plans: Plan[] }

const useWho = () => useSession((s) => s.me?.id ?? 'guest');
export const usePlans = (filter: string, q: string) => { const w = useWho(); return useQuery({ queryKey: ['plans', filter, q, w], queryFn: () => api<Plan[]>(`/plans?filter=${filter}&q=${encodeURIComponent(q)}`), placeholderData: (p) => p }); };
export const usePlan = (id: string) => { const w = useWho(); return useQuery({ queryKey: ['plans', 'one', id, w], queryFn: () => api<PlanDetail>(`/plans/${id}`) }); };
export const useStudio = () => { const w = useWho(); return useQuery({ queryKey: ['plans', 'studio', w], queryFn: () => api<Studio>('/plans/studio'), enabled: w !== 'guest' }); };
export const useListing = (tripId: string | undefined) => useQuery({ queryKey: ['plans', 'listing', tripId], queryFn: () => api<PlanDetail | null>(`/trips/${tripId}/plan`), enabled: !!tripId });
const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['plans'] }), queryClient.invalidateQueries({ queryKey: ['wallet'] })]);
export const useBuyPlan = () => useMutation({ mutationFn: (v: { id: string; pin?: string; key: string }) => api(`/plans/${v.id}/buy`, { method: 'POST', body: { pin: v.pin }, idempotencyKey: v.key }), onSuccess: refresh });
export const useListPlan = () => useMutation({ mutationFn: (v: { tripId: string; mode: 'private' | 'free' | 'sell'; price?: number; summary?: string }) => api<PlanDetail & { sellerGets: number; fee: number }>(`/trips/${v.tripId}/plan`, { method: 'PUT', body: { mode: v.mode, price: v.price, summary: v.summary } }), onSuccess: refresh });
