import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from '@tanstack/react-query';
import { colors } from '@everycation/tokens';
import { IconAdventure, IconCalendar, IconInspire, IconShield, IconTrip, type Icon } from '@/ui/icons';
import { api } from './api';
import { isUuid, type Author } from './community';
import { queryClient } from './query';
import { useSession } from './session';

export type MomentKind = 'status' | 'event' | 'trip' | 'safety' | 'fun';
export interface Moment {
  id: string; kind: MomentKind; body: string; media: { kind: 'image' | 'video' | 'audio'; url: string } | null;
  place: string | null; countryCode: string | null; eventDate: string | null;
  likes: number; comments: number; createdAt: string; author: Author; liked: boolean; mine: boolean;
}
export interface MomentComment { id: string; body: string; createdAt: string; author: Author; isAuthor: boolean; mine: boolean }
interface Page { items: Moment[]; next: string | null }

/** How each kind looks. `wash` is the gradient behind a moment that is only words. */
export const KINDS: Record<MomentKind, { label: string; plural: string; icon: Icon; bg: string; ink: string; wash: [string, string]; hint: string }> = {
  status: { label: 'Status', plural: 'Status', icon: IconInspire, bg: colors.tint, ink: colors.navy, wash: [colors.navy, colors.headingBlue], hint: 'Where are you, and how is it going?' },
  event: { label: 'Event', plural: 'Events', icon: IconCalendar, bg: colors.goldSoft, ink: colors.onGold, wash: ['#7A3E00', '#D98200'], hint: 'What is happening, and who should come?' },
  trip: { label: 'Trip talk', plural: 'Trip talk', icon: IconTrip, bg: '#E0F4FC', ink: colors.blue, wash: [colors.blue, colors.cyan], hint: 'Ask, plan or share something about a trip' },
  safety: { label: 'Safety', plural: 'Safety', icon: IconShield, bg: colors.dangerSoft, ink: colors.danger, wash: ['#7A1610', colors.danger], hint: 'What should travellers nearby know? Stick to what you saw.' },
  fun: { label: 'Fun', plural: 'Fun', icon: IconAdventure, bg: '#F2E8FF', ink: '#5B21B6', wash: ['#4C1D95', '#9333EA'], hint: 'Something that made you smile on the road' },
};
export const KIND_ORDER = Object.keys(KINDS) as MomentKind[];

const useWho = () => useSession((s) => s.me?.id ?? 'guest');

/** Newest first, 20 at a time; call fetchNextPage for more. */
export function useMoments(kind?: MomentKind) {
  const w = useWho();
  return useInfiniteQuery({
    queryKey: ['moments', 'feed', kind ?? 'all', w],
    queryFn: ({ pageParam }) => api<Page>(`/moments?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(pageParam ? { before: pageParam } : {}) })}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.next ?? undefined,
  });
}
export const useMoment = (id: string) => { const w = useWho(); return useQuery({ queryKey: ['moments', 'one', id, w], queryFn: () => api<Moment>(`/moments/${id}`), enabled: isUuid(id) }); };
export const useMomentComments = (id: string) => { const w = useWho(); return useQuery({ queryKey: ['moments', 'comments', id, w], queryFn: () => api<MomentComment[]>(`/moments/${id}/comments`), enabled: isUuid(id) }); };

const refresh = () => queryClient.invalidateQueries({ queryKey: ['moments'] });

/** Changes one moment wherever it is cached: in every feed page and on its own screen. */
function patch(id: string, change: (m: Moment) => Moment) {
  queryClient.setQueriesData<InfiniteData<Page>>({ queryKey: ['moments', 'feed'] }, (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === id ? change(m) : m)) })) });
  queryClient.setQueriesData<Moment>({ queryKey: ['moments', 'one', id] }, (m) => m && change(m));
}

export interface NewMoment { kind: MomentKind; body: string; mediaId?: string; place?: string; countryCode?: string; eventDate?: string }
export const useCreateMoment = () => useMutation({ mutationFn: (b: NewMoment) => api<Moment>('/moments', { method: 'POST', body: b }), onSuccess: refresh });
export const useRemoveMoment = () => useMutation({ mutationFn: (id: string) => api(`/moments/${id}`, { method: 'DELETE' }), onSuccess: refresh });

/** The heart fills straight away; the server's count replaces the guess when it answers, and a failure puts it back. */
export const useLikeMoment = () => useMutation({
  mutationFn: (id: string) => api<{ liked: boolean; likes: number }>(`/moments/${id}/like`, { method: 'POST' }),
  onMutate: (id) => patch(id, (m) => ({ ...m, liked: !m.liked, likes: Math.max(0, m.likes + (m.liked ? -1 : 1)) })),
  onSuccess: (r, id) => patch(id, (m) => ({ ...m, ...r })),
  onError: (_e, id) => patch(id, (m) => ({ ...m, liked: !m.liked, likes: Math.max(0, m.likes + (m.liked ? -1 : 1)) })),
});
export const useAddMomentComment = (id: string) => useMutation({
  mutationFn: (body: string) => api<MomentComment[]>(`/moments/${id}/comments`, { method: 'POST', body: { body } }),
  onSuccess: (list) => { queryClient.setQueriesData({ queryKey: ['moments', 'comments', id] }, list); patch(id, (m) => ({ ...m, comments: list.length })); },
});
export const useRemoveMomentComment = (id: string) => useMutation({
  mutationFn: (commentId: string) => api<MomentComment[]>(`/moments/${id}/comments/${commentId}`, { method: 'DELETE' }),
  onSuccess: (list) => { queryClient.setQueriesData({ queryKey: ['moments', 'comments', id] }, list); patch(id, (m) => ({ ...m, comments: list.length })); },
});
