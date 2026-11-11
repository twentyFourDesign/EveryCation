'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { adminApi, ago, errorMessage, naira } from '@/lib/api';
import { Avatar, Badge, Button, Card, Chips, Input, Notice, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { accessFor, useSession } from '@/lib/session';

type Kyc = 'none' | 'pending' | 'verified' | 'failed';
interface Row { id: string; name: string; phone: string; handle: string | null; joined: string; kyc: Kyc; status: 'active' | 'suspended'; walletFrozen: boolean; wallet: number; plansSold: number }
interface List { counts: { total: number; verified: number; kyc_failed: number; suspended: number; frozen: number }; users: Row[] }
interface Detail { id: string; name: string; phone: string; handle: string | null; city: string | null; joined: string; status: 'active' | 'suspended'; walletFrozen: boolean; kyc: { status: Kyc; method: string | null; attempts: number; legalName: string | null }; hasPin: boolean; pinLocked: boolean; wallet: { available: number; inGoals: number }; tips: number; advice: number; verifiedAdvice: number; trips: number; lastSeen: string | null; banks: { bank: string; account: string; name: string; isDefault: boolean }[] }
type Action = 'suspend' | 'reinstate' | 'freeze' | 'unfreeze' | 'reset_kyc' | 'reset_pin';
const filters = [{ value: 'all', label: 'All' }, { value: 'kyc_failed', label: 'ID check failed' }, { value: 'sellers', label: 'Plan sellers' }, { value: 'frozen', label: 'Wallet frozen' }, { value: 'suspended', label: 'Suspended' }] as const;
const kycLabel: Record<Kyc, string> = { none: 'Not started', pending: 'Checking', verified: 'Verified', failed: 'Failed' };
const done: Record<Action, string> = { suspend: 'Account suspended, wallet frozen and all devices signed out', reinstate: 'Account reinstated', freeze: 'Wallet frozen', unfreeze: 'Wallet unfrozen', reset_kyc: 'ID check attempts reset', reset_pin: 'Wallet PIN reset and the customer told to create a new one' };
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function Users() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'users') === 'Edit';
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all'); const [term, setTerm] = useState(''); const [selected, setSelected] = useState<string | null>(null); const [notice, setNotice] = useState(''); const [confirm, setConfirm] = useState<Action | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['users', filter, term], queryFn: () => adminApi<List>(`/users?filter=${filter}&q=${encodeURIComponent(term)}`), placeholderData: (p) => p });
  const { data: user } = useQuery({ queryKey: ['user', selected], queryFn: () => adminApi<Detail>(`/users/${selected}`), enabled: !!selected });
  const act = useMutation({
    mutationFn: (action: Action) => adminApi<Detail>(`/users/${selected}/action`, { method: 'POST', body: { action } }),
    onSuccess: (d, action) => { setNotice(`${done[action]} for ${d.name}. Recorded in the audit log.`); qc.setQueryData(['user', selected], d); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => setNotice(errorMessage(e)), onSettled: () => setConfirm(null),
  });
  const facts: [string, string][] = user ? [
    ['ID check', `${kycLabel[user.kyc.status]}${user.kyc.method ? ` · ${user.kyc.method}` : ''}`], ...(user.kyc.legalName ? [['Name on ID', user.kyc.legalName] as [string, string]] : []), ['ID check attempts', String(user.kyc.attempts)],
    ['Wallet balance', naira(user.wallet.available)], ['In savings goals', naira(user.wallet.inGoals)], ['Wallet PIN', user.pinLocked ? 'Locked after wrong tries' : user.hasPin ? 'Set' : 'Not set'],
    ['Trips', String(user.trips)], ['Tips posted', String(user.tips)], ['Advice', `${user.advice} · ${user.verifiedAdvice} verified`], ['Joined', day(user.joined)], ['Last signed in', user.lastSeen ? `${ago(user.lastSeen)} ago` : 'Never'],
  ] : [];
  return (
    <>
      <PageHeader title="Users & KYC" subtitle={data ? `${data.counts.total.toLocaleString()} accounts · ${data.counts.verified.toLocaleString()} with a verified wallet` : 'Loading…'}>
        <div className="relative"><Search aria-hidden className="absolute top-3 left-3.5 size-5 text-ink-muted" /><Input aria-label="Search users" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, phone or handle" className="w-72 max-w-full pl-11" /></div>
      </PageHeader>
      <Chips label="Filter users" value={filter} onChange={setFilter} options={filters} />
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="flex-[3_1_560px] overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="sr-only">Users</caption>
            <thead><tr>{['User', 'Joined', 'ID check', 'Wallet', 'Plans sold', 'Status'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className={cn('cursor-pointer hover:bg-surface-muted', selected === u.id && 'bg-surface-muted')} onClick={() => { setSelected(u.id); setNotice(''); setConfirm(null); }}>
                  <td className={td}><button className="flex cursor-pointer flex-col text-left" aria-pressed={selected === u.id}><b className="font-semibold">{u.name}</b><span className="text-xs text-ink-muted">{u.phone}{u.handle ? ` · @${u.handle}` : ''}</span></button></td>
                  <td className={`${td} whitespace-nowrap`}>{day(u.joined)}</td>
                  <td className={td}><Badge tone={u.kyc === 'failed' ? 'danger' : u.kyc === 'verified' ? 'info' : 'neutral'}>{kycLabel[u.kyc]}</Badge></td>
                  <td className={`${td} tnum whitespace-nowrap`}>{u.kyc === 'verified' || u.wallet ? naira(u.wallet) : '—'}</td>
                  <td className={`${td} tnum`}>{u.plansSold}</td>
                  <td className={td}><Badge tone={u.status === 'suspended' || u.walletFrozen ? 'danger' : 'neutral'}>{u.status === 'suspended' ? 'Suspended' : u.walletFrozen ? 'Wallet frozen' : 'Active'}</Badge></td>
                </tr>
              ))}
              {!data?.users.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading users…' : 'No users match.'}</td></tr>}
            </tbody>
          </table>
        </Card>
        {user && (
          <Card className="flex flex-[1_1_320px] flex-col gap-4">
            <div className="flex items-center gap-3"><Avatar initials={initials(user.name)} className="size-12" /><div className="flex flex-col"><b className="font-semibold">{user.name}</b><span className="text-xs text-ink-muted">{user.phone}{user.city ? ` · ${user.city}` : ''}</span></div></div>
            {(user.status === 'suspended' || user.walletFrozen) && <p className="rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger">{user.status === 'suspended' ? 'This account is suspended and cannot sign in.' : 'The wallet is frozen. No money can leave it.'}</p>}
            <dl className="flex flex-col text-sm">{facts.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line py-2.5"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}</dl>
            {user.banks.length > 0 && <div className="flex flex-col gap-1 text-sm"><b className="font-semibold">Bank accounts</b>{user.banks.map((b) => <span key={b.account + b.bank} className="text-ink-muted">{b.bank} {b.account} · {b.name}{b.isDefault ? ' · main' : ''}</span>)}</div>}
            {canEdit ? (confirm
              ? <div className="flex flex-col gap-2 rounded-2xl border border-line p-3"><p className="text-sm">{confirm === 'suspend' ? 'Suspend this account? They will be signed out everywhere and their wallet frozen.' : 'Reset the wallet PIN? They must create a new one before they can withdraw.'}</p><div className="flex gap-2"><Button size="sm" variant="danger" disabled={act.isPending} onClick={() => act.mutate(confirm)}>{confirm === 'suspend' ? 'Yes, suspend' : 'Yes, reset PIN'}</Button><Button size="sm" onClick={() => setConfirm(null)}>Cancel</Button></div></div>
              : <div className="flex flex-wrap gap-2">
                  {user.status === 'suspended' ? <Button size="sm" variant="navy" disabled={act.isPending} onClick={() => act.mutate('reinstate')}>Reinstate account</Button> : <>
                    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate(user.walletFrozen ? 'unfreeze' : 'freeze')}>{user.walletFrozen ? 'Unfreeze wallet' : 'Freeze wallet'}</Button>
                    {(user.kyc.status === 'failed' || user.kyc.attempts > 0) && user.kyc.status !== 'verified' && <Button size="sm" disabled={act.isPending} onClick={() => act.mutate('reset_kyc')}>Let them retry ID check</Button>}
                    {user.hasPin && <Button size="sm" onClick={() => setConfirm('reset_pin')}>Reset PIN</Button>}
                    <Button size="sm" variant="danger" onClick={() => setConfirm('suspend')}>Suspend</Button></>}
                </div>)
              : <p className="text-xs text-ink-muted">Your role can view accounts but not change them.</p>}
          </Card>
        )}
      </div>
    </>
  );
}
