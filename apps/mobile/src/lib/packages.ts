import { useQuery } from '@tanstack/react-query';
import type { Vibe } from './trips';
import { api } from './api';

export interface TravelPackage {
  id: string; title: string; summary: string; destination: string; countryCode: string; countryName: string; lat: number | null; lng: number | null;
  nights: number; price: number; priceNote: string; includes: string[]; excludes: string[]; itinerary: { day: string; title: string; detail: string }[];
  vibe: Vibe | null; imageKey: string | null; imageUrl: string | null; plan: 'listing' | 'featured' | 'spotlight'; travelFrom: string | null; travelTo: string | null;
  advertiser: { id: string; name: string; kind: string }; sample: boolean; contact: { whatsapp: boolean; call: boolean; website: boolean };
}
export type Channel = 'whatsapp' | 'call' | 'website' | 'save';

export const usePackages = (q: { plan?: 'featured'; country?: string } = {}) => useQuery({
  queryKey: ['packages', q.plan ?? '', q.country ?? ''],
  queryFn: () => api<TravelPackage[]>(`/packages?${new URLSearchParams({ ...(q.plan && { plan: q.plan }), ...(q.country && { country: q.country }) })}`, { auth: false }),
  staleTime: 300_000,
});
export const usePackage = (id: string) => useQuery({ queryKey: ['packages', id], queryFn: () => api<TravelPackage>(`/packages/${id}`, { auth: false }) });
export const enquire = (id: string, channel: Channel) => api<{ url: string | null; sample: boolean }>(`/packages/${id}/enquire`, { method: 'POST', body: { channel }, auth: false });
