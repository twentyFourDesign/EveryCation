import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { queryClient } from './query';
import { useSession } from './session';

export interface Country { code: string; name: string }
export type Entry = 'visa_free' | 'visa_on_arrival' | 'eta' | 'e_visa' | 'visa_required' | 'no_admission' | 'own_country' | 'unknown';
export type Tone = 'good' | 'warn' | 'bad' | 'neutral';
export type Section = 'documents' | 'health' | 'money' | 'before';
export interface Requirement { from: string; to: string; fromName: string; toName: string; entry: Entry; days: number | null; title: string; tone: Tone; summary: string; notes: string[]; apply: { label: string; url: string } | null; checklist: { section: Section; text: string }[]; updated: string; source: string }
export interface ChecklistSummary { id: string; passport: string; destination: string; destinationName: string; tripId: string | null; total: number; done: number }
export interface ChecklistItem { id: string; section: Section; text: string; done: boolean; own: boolean }
export interface Checklist { id: string; passport: string; passportName: string; destination: string; destinationName: string; tripId: string | null; requirement: Pick<Requirement, 'entry' | 'days' | 'title' | 'tone' | 'summary'>; items: ChecklistItem[] }

export const SECTIONS: Record<Section, { title: string; emoji: string }> = {
  documents: { title: 'Documents', emoji: '🛂' }, health: { title: 'Health', emoji: '💉' }, money: { title: 'Money', emoji: '💳' }, before: { title: 'Before you go', emoji: '🧳' },
};

export const useCountries = () => useQuery({ queryKey: ['countries'], queryFn: () => api<Country[]>('/travel/countries'), staleTime: Infinity });
export const useRequirement = (from?: string, to?: string) => useQuery({ queryKey: ['requirement', from, to], queryFn: () => api<Requirement>(`/travel/requirements?from=${from}&to=${to}`), enabled: !!from && !!to, staleTime: 3_600_000 });
export const useChecklists = () => { const on = useSession((s) => s.status === 'signedIn'); return useQuery({ queryKey: ['checklists'], queryFn: () => api<ChecklistSummary[]>('/travel/checklists'), enabled: on }); };
export const useChecklist = (id: string) => { const on = useSession((s) => s.status === 'signedIn'); return useQuery({ queryKey: ['checklists', id], queryFn: () => api<Checklist>(`/travel/checklists/${id}`), enabled: on }); };

const store = (c: Checklist) => { queryClient.setQueryData(['checklists', c.id], c); void queryClient.invalidateQueries({ queryKey: ['checklists'], exact: true }); };
export const useCreateChecklist = () => useMutation({ mutationFn: (b: { from: string; to: string; tripId?: string }) => api<Checklist>('/travel/checklists', { method: 'POST', body: b }), onSuccess: store });
export const useTickItem = (id: string) => useMutation({
  mutationFn: (v: { itemId: string; done: boolean }) => api<Checklist>(`/travel/checklists/${id}/items/${v.itemId}`, { method: 'PATCH', body: { done: v.done } }),
  // Tick straight away; the server's answer replaces it.
  onMutate: (v) => queryClient.setQueryData<Checklist>(['checklists', id], (c) => c && { ...c, items: c.items.map((i) => (i.id === v.itemId ? { ...i, done: v.done } : i)) }),
  onSuccess: store, onError: () => queryClient.invalidateQueries({ queryKey: ['checklists', id] }),
});
export const useAddChecklistItem = (id: string) => useMutation({ mutationFn: (b: { text: string; section: Section }) => api<Checklist>(`/travel/checklists/${id}/items`, { method: 'POST', body: b }), onSuccess: store });
export const useRemoveChecklistItem = (id: string) => useMutation({ mutationFn: (itemId: string) => api<Checklist>(`/travel/checklists/${id}/items/${itemId}`, { method: 'DELETE' }), onSuccess: store });
export const useDeleteChecklist = () => useMutation({ mutationFn: (id: string) => api<void>(`/travel/checklists/${id}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklists'] }) });

/** 🇳🇬 from "NG". */
export const flag = (code?: string | null) => (code && /^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');
export const TONE_STYLE: Record<Tone, { bg: string; ink: string; emoji: string }> = {
  good: { bg: '#E2F5E6', ink: '#1E7034', emoji: '✅' }, warn: { bg: '#FFF1BC', ink: '#7A5A00', emoji: '📝' }, bad: { bg: '#FDE4E1', ink: '#B42318', emoji: '🛂' }, neutral: { bg: '#F1F1F1', ink: '#262626', emoji: '🏠' },
};
