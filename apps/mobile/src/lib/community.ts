import { useMutation, useQuery } from '@tanstack/react-query';
import { sample, type ImageKey } from '@everycation/shared';
import { api } from './api';
import { photos } from '../ui/photos';
import { queryClient } from './query';
import { useSession } from './session';

export interface Author { id: string; name: string; handle: string | null; city: string | null }
export interface Tip {
  id: string; title: string; place: string; countryCode: string | null; category: string; format: 'write' | 'video' | 'voice'; body: string; goodToKnow: string[];
  imageKey: string | null; visited: string | null; likes: number; comments: number; createdAt: string; author: Author; liked: boolean; mine: boolean;
}
export interface TipComment { id: string; body: string; createdAt: string; author: Author; isTipAuthor: boolean; mine: boolean }
export type AdviceStatus = 'in_review' | 'changes_requested' | 'verified' | 'rejected' | 'rereview';
export interface Advice {
  id: string; countryCode: string; city: string; topic: string; body: string; visited: string | null; status: AdviceStatus; helpful: number; createdAt: string;
  author: Author & { passportCountry: string | null }; mine: boolean; markedHelpful: boolean; reviewNote: string | null;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export const initials = (name: string) => name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'T';
/** Tips carry a bundled sample photo until media uploads are connected; others get a stock one. */
export const tipImage = (t: Pick<Tip, 'imageKey' | 'id'>): ImageKey => (t.imageKey && t.imageKey in photos ? (t.imageKey as ImageKey) : (['lagoon-aerial', 'alpine-lake', 'jungle-cove', 'waterfall'] as const)[t.id.charCodeAt(0) % 4]!);
export const timeAgo = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000)); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 43200 ? `${Math.round(m / 1440)}d` : new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
export const countryName = (code: string) => sample.countries.find((c) => c.code === code.toUpperCase())?.name ?? code;
/** "London, United Kingdom" or "Ghana" → the country it names, if we know it. */
export const findCountry = (text: string) => { const t = text.trim().toLowerCase(); return t.length < 2 ? undefined : sample.countries.find((c) => c.name.toLowerCase() === t) ?? sample.countries.find((c) => t.endsWith(c.name.toLowerCase())) ?? sample.countries.find((c) => c.name.toLowerCase().startsWith(t)); };

// The signed-in user is part of the key: "liked by me" and my own unreviewed advice differ per person.
const useWho = () => useSession((s) => s.me?.id ?? 'guest');

export const useTips = (feed: 'latest' | 'popular' = 'latest') => { const w = useWho(); return useQuery({ queryKey: ['tips', feed, w], queryFn: () => api<Tip[]>(`/tips?feed=${feed}`) }); };
export const useTip = (id: string) => { const w = useWho(); return useQuery({ queryKey: ['tip', id, w], queryFn: () => api<Tip>(`/tips/${id}`), enabled: isUuid(id) }); };
export const useTipComments = (id: string) => { const w = useWho(); return useQuery({ queryKey: ['tip', id, 'comments', w], queryFn: () => api<TipComment[]>(`/tips/${id}/comments`), enabled: isUuid(id) }); };
export const useAdviceCounts = () => useQuery({ queryKey: ['advice', 'countries'], queryFn: () => api<{ code: string; total: number; verified: number }[]>('/advice/countries') });
export const useCountryAdvice = (code: string, verifiedOnly: boolean) => { const w = useWho(); return useQuery({ queryKey: ['advice', code, verifiedOnly, w], queryFn: () => api<Advice[]>(`/advice?country=${code}&verifiedOnly=${verifiedOnly}`) }); };

const refreshTips = () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tips' || q.queryKey[0] === 'tip' });
const refreshAdvice = () => queryClient.invalidateQueries({ queryKey: ['advice'] });

export const useCreateTip = () => useMutation({ mutationFn: (b: { title: string; place: string; category: string; format: Tip['format']; body?: string; countryCode?: string }) => api<Tip>('/tips', { method: 'POST', body: b }), onSuccess: refreshTips });
export const useLikeTip = () => useMutation({ mutationFn: (id: string) => api<{ liked: boolean; likes: number }>(`/tips/${id}/like`, { method: 'POST' }), onSuccess: refreshTips });
export const useAddComment = (tipId: string) => useMutation({ mutationFn: (body: string) => api<TipComment[]>(`/tips/${tipId}/comments`, { method: 'POST', body: { body } }), onSuccess: refreshTips });
export const useReport = () => useMutation({ mutationFn: (b: { targetType: 'tip' | 'comment' | 'advice'; targetId: string; reason: string }) => api<{ alreadyReported: boolean }>('/reports', { method: 'POST', body: b }), onSuccess: refreshAdvice });
export const useShareAdvice = () => useMutation({ mutationFn: (b: { countryCode: string; city: string; topic: string; body: string; visited?: string; showPassport: boolean }) => api<{ id: string }>('/advice', { method: 'POST', body: b }), onSuccess: refreshAdvice });
export const useReviseAdvice = () => useMutation({ mutationFn: (b: { id: string; body: string }) => api(`/advice/${b.id}`, { method: 'PATCH', body: { body: b.body } }), onSuccess: refreshAdvice });
export const useMarkHelpful = () => useMutation({ mutationFn: (id: string) => api<{ markedHelpful: boolean; helpful: number }>(`/advice/${id}/helpful`, { method: 'POST' }), onSuccess: refreshAdvice });
