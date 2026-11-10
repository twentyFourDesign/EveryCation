import { useMutation, useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import type { ImageKey } from '@everycation/shared';
import { api } from './api';
import { queryClient } from './query';
import { useSession, type Me } from './session';

export interface Goal { id: string; name: string; kind: 'trip' | 'shopping' | 'package'; target: number; saved: number; percent: number; targetDate: string | null; locked: boolean; autoSave: { amount: number; frequency: 'daily' | 'weekly' | 'monthly' } | null }
export interface Bank { id: string; bankName: string; last4: string; accountName: string; isDefault: boolean; addedAt: string }
export interface Wallet {
  available: number; inGoals: number; total: number; goals: Goal[]; banks: Bank[]; frozen: boolean; dailyWithdrawalLimit: number;
  setup: { identity: 'none' | 'verified' | 'failed'; hasPin: boolean; hasBank: boolean; ready: boolean };
}
export interface HistoryItem { reference: string; kind: string; description: string; at: string; movements: { account: string; amount: number }[] }
export interface Withdrawal { id: string; reference: string; amount: number; status: 'processing' | 'held' | 'paid' | 'failed' | 'rejected'; holdReason: string | null; message: string | null; createdAt: string }

/** The wallet from the API. Only runs when signed in. */
export function useWallet() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({ queryKey: ['wallet'], queryFn: () => api<Wallet>('/wallet'), enabled: signedIn });
}
export const useWalletHistory = () => useQuery({ queryKey: ['wallet', 'history'], queryFn: () => api<{ items: HistoryItem[] }>('/wallet/history?limit=50') });

const refresh = async () => {
  await queryClient.invalidateQueries({ queryKey: ['wallet'] });
  useSession.setState({ me: await api<Me>('/auth/me') });
};
const mutation = <V, R = unknown>(fn: (v: V) => Promise<R>) => () => useMutation({ mutationFn: fn, onSuccess: refresh });

export const useVerifyIdentity = mutation((b: { method: 'BVN' | 'NIN'; number: string; dateOfBirth: string }) => api('/wallet/identity', { method: 'POST', body: b }));
export const useSetPin = mutation((b: { pin: string; currentPin?: string }) => api('/wallet/pin', { method: 'PUT', body: b }));
export const useAddBank = mutation((b: { bankName: string; accountNumber: string }) => api<Bank>('/wallet/banks', { method: 'POST', body: b }));
export const useFreeze = mutation((frozen: boolean) => api('/wallet/freeze', { method: 'POST', body: { frozen } }));
export const useCreateGoal = mutation((b: Partial<Goal> & { name: string; kind: Goal['kind']; target: number; autoSaveAmount?: number; autoSaveFrequency?: string }) => api<Goal>('/wallet/goals', { method: 'POST', body: b }));
export const useUpdateGoal = mutation(({ id, ...patch }: { id: string; locked?: boolean; name?: string; target?: number }) => api<Goal>(`/wallet/goals/${id}`, { method: 'PATCH', body: patch }));
/** `key` must stay the same if the same attempt is retried, so the money can only move once. */
export const useMoveGoal = mutation((b: { goalId: string; amount: number; direction: 'in' | 'out'; key: string }) => api(`/wallet/goals/${b.goalId}/move`, { method: 'POST', body: { amount: b.amount, direction: b.direction }, idempotencyKey: b.key }));
export const useWithdraw = mutation((b: { amount: number; source: string; pin: string; key: string }) => api<Withdrawal>('/wallet/withdrawals', { method: 'POST', body: { amount: b.amount, source: b.source, pin: b.pin }, idempotencyKey: b.key }));
/** Development only: pretends the bank confirmed a transfer or card payment. */
export const useDevDeposit = mutation((b: { amount: number; goalId?: string; channel: 'transfer' | 'card' }) => api('/wallet/dev/deposit', { method: 'POST', body: b }));

/** Goals carry no photo yet, so pick one from what they are for. */
export const goalImage = (g: Pick<Goal, 'kind' | 'name'>): ImageKey =>
  g.kind === 'shopping' ? 'product-3' : /venice/i.test(g.name) ? 'venice-canal' : /dolomite|alp|mountain/i.test(g.name) ? 'alpine-lake' : /bali|beach|island/i.test(g.name) ? 'lagoon-aerial' : 'jungle-cove';
export const formatDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
export const daysUntil = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null);

/** The next unfinished setup step, in order: identity, PIN, bank. */
export const nextSetupStep = (s: Wallet['setup']): Href => (s.identity !== 'verified' ? '/wallet/setup/identity' : !s.hasPin ? '/wallet/setup/pin' : '/wallet/setup/bank');
