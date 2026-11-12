import { useMutation, useQuery } from '@tanstack/react-query';
import type { ImageKey } from '@everycation/shared';
import { photos } from '../ui/photos';
import { api } from './api';
import { queryClient } from './query';
import { useSession } from './session';

export interface Trip { id: string; title: string; place: string; countryCode: string; lat: number | null; lng: number | null; pinned: boolean; startDate: string; endDate: string; nights: number; travellers: number; imageKey: string | null; status: 'upcoming' | 'now' | 'past'; daysAway: number | null }
export interface ItineraryItem { id: string; day: string; time: string; title: string; note: string; remind: string | null }
export interface TripDetail extends Trip { itinerary: ItineraryItem[] }
export interface BucketItem { id: string; title: string; state: 'dream' | 'done'; source: string | null; imageKey: string | null }

const useSignedIn = () => useSession((s) => s.status === 'signedIn');
export const useTrips = () => { const on = useSignedIn(); return useQuery({ queryKey: ['trips'], queryFn: () => api<Trip[]>('/trips'), enabled: on }); };
export const useTrip = (id: string) => useQuery({ queryKey: ['trips', id], queryFn: () => api<TripDetail>(`/trips/${id}`) });
export const useBucket = () => { const on = useSignedIn(); return useQuery({ queryKey: ['bucket'], queryFn: () => api<BucketItem[]>('/bucket-list'), enabled: on }); };

const refreshTrips = () => queryClient.invalidateQueries({ queryKey: ['trips'] });
const setBucket = (list: BucketItem[]) => queryClient.setQueryData(['bucket'], list);
export const useCreateTrip = () => useMutation({ mutationFn: (b: { title: string; place: string; countryCode: string; startDate: string; endDate: string; travellers: number; imageKey?: string; lat?: number; lng?: number }) => api<Trip>('/trips', { method: 'POST', body: b }), onSuccess: refreshTrips });
export const useAddItem = () => useMutation({ mutationFn: ({ tripId, ...b }: { tripId: string; day: string; time: string; title: string; note?: string; remind?: string }) => api<TripDetail>(`/trips/${tripId}/items`, { method: 'POST', body: b }), onSuccess: refreshTrips });
export const useRemoveItem = () => useMutation({ mutationFn: (v: { tripId: string; itemId: string }) => api<TripDetail>(`/trips/${v.tripId}/items/${v.itemId}`, { method: 'DELETE' }), onSuccess: refreshTrips });
export const useAddBucket = () => useMutation({ mutationFn: (b: { title: string; source?: string; imageKey?: string }) => api<BucketItem[]>('/bucket-list', { method: 'POST', body: b }), onSuccess: setBucket });
export const useSetBucketState = () => useMutation({ mutationFn: (v: { id: string; state: 'dream' | 'done' }) => api<BucketItem[]>(`/bucket-list/${v.id}`, { method: 'PATCH', body: { state: v.state } }), onSuccess: setBucket });
export const useRemoveBucket = () => useMutation({ mutationFn: (id: string) => api<BucketItem[]>(`/bucket-list/${id}`, { method: 'DELETE' }), onSuccess: setBucket });

// Dates are calendar days ("2026-12-12"); parse them as UTC so they never shift with the phone's time zone.
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => utc(iso).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
export const dayLabel = (iso: string) => fmt(iso, { weekday: 'short', day: 'numeric' });
export const tripDates = (t: Pick<Trip, 'startDate' | 'endDate'>) => `${fmt(t.startDate, { day: 'numeric', month: 'short' })} – ${fmt(t.endDate)}`;
export const daysOf = (t: Pick<Trip, 'startDate' | 'endDate'>) => { const out: string[] = []; for (let d = utc(t.startDate); d <= utc(t.endDate) && out.length < 60; d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10)); return out; };
/** "12/12/2026" → "2026-12-12", or null when it is not a real date. */
export function toIso(input: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`; const d = utc(iso);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) ? iso : null;
}
const scenic: ImageKey[] = ['alpine-lake', 'lagoon-aerial', 'venice-canal', 'waterfall', 'giza-traveller', 'bali-temple', 'jungle-cove'];
export const tripImage = (t: { imageKey: string | null; id: string }): ImageKey => (t.imageKey && t.imageKey in photos ? (t.imageKey as ImageKey) : scenic[t.id.charCodeAt(0) % scenic.length]!);

/** A place suggested while the traveller types where they are going. */
export interface PlaceHit { name: string; detail: string; label: string; countryCode: string; lat: number; lng: number; source: 'everycation' | 'map' }
export const usePlaceSearch = (term: string) => useQuery({ queryKey: ['place-search', term.toLowerCase()], queryFn: () => api<PlaceHit[]>(`/geo/search?q=${encodeURIComponent(term)}`), enabled: term.length >= 2, staleTime: 600_000, placeholderData: (previous) => previous });
