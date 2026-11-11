'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { adminApi, errorMessage, naira, when } from '@/lib/api';
import { Badge, Button, Card, Chips, Input, Notice, PageHeader } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

type Status = 'on_sale' | 'scheduled' | 'free' | 'removed';
interface Plan { id: string; title: string; place: string; days: number; stops: number; price: number; status: Status; opensAt: string | null; used: number; author: { name: string } }
const filters = [{ value: 'all', label: 'All' }, { value: 'on_sale', label: 'On sale' }, { value: 'scheduled', label: 'Waiting for trip to end' }, { value: 'free', label: 'Free' }, { value: 'removed', label: 'Removed' }] as const;
const label: Record<Status, string> = { on_sale: 'On sale', scheduled: 'Waiting', free: 'Free', removed: 'Removed' };
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm align-top';

export default function TripPlans() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'plans') === 'Edit';
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all'); const [term, setTerm] = useState(''); const [notice, setNotice] = useState(''); const [removing, setRemoving] = useState<string | null>(null);
  const { data = [], isLoading, error } = useQuery({ queryKey: ['plans'], queryFn: () => adminApi<Plan[]>('/plans') });
  const remove = useMutation({
    mutationFn: (v: { p: Plan; refund: boolean }) => adminApi<{ refunded: number; total: number; alreadyPaidOut: number }>(`/plans/${v.p.id}/remove`, { method: 'POST', body: { refund: v.refund } }),
    onSuccess: (r, v) => { setNotice(`"${v.p.title}" removed and the seller told.${r.refunded ? ` ${naira(r.total)} went back to ${r.refunded} buyer${r.refunded === 1 ? '' : 's'}.` : ''}${r.alreadyPaidOut ? ` ${r.alreadyPaidOut} sale${r.alreadyPaidOut === 1 ? ' was' : 's were'} already paid out to the seller and not refunded.` : ''}`); qc.invalidateQueries({ queryKey: ['plans'] }); },
    onError: (e) => setNotice(errorMessage(e)), onSettled: () => setRemoving(null),
  });
  const rows = data.filter((p) => filter === 'all' || p.status === filter).filter((p) => `${p.title} ${p.place} ${p.author.name}`.toLowerCase().includes(term.toLowerCase()));
  return (
    <>
      <PageHeader title="Trip plans" subtitle="Paid plans go on sale at 6:00 am the day after the trip ends">
        <div className="relative"><Search aria-hidden className="absolute top-3 left-3.5 size-5 text-ink-muted" /><Input aria-label="Search plans" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Plan, place or seller" className="w-72 max-w-full pl-11" /></div>
      </PageHeader>
      <Chips label="Filter plans" value={filter} onChange={setFilter} options={filters} />
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full"><caption className="sr-only">Trip plans</caption>
          <thead><tr>{['Plan', 'Seller', 'Price', 'Sold or used', 'Status', ''].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={td}><b className="font-semibold">{p.title}</b><span className="block text-xs text-ink-muted">{p.place} · {p.days} day{p.days === 1 ? '' : 's'} · {p.stops} stops</span></td>
                <td className={td}>{p.author.name}</td>
                <td className={`${td} tnum whitespace-nowrap`}>{p.price ? naira(p.price) : 'Free'}</td>
                <td className={`${td} tnum`}>{p.used}</td>
                <td className={td}><Badge tone={p.status === 'removed' ? 'danger' : p.status === 'on_sale' ? 'info' : 'neutral'}>{label[p.status]}</Badge>{p.opensAt && <span className="mt-1 block text-xs text-ink-muted">Opens {when(p.opensAt)}</span>}</td>
                <td className={`${td} whitespace-nowrap`}>{canEdit && p.status !== 'removed' && (removing === p.id
                  ? <span className="flex flex-wrap items-center gap-2">{p.price > 0 && p.used > 0
                      ? <><Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => remove.mutate({ p, refund: true })}>Remove and refund buyers</Button><Button size="sm" disabled={remove.isPending} onClick={() => remove.mutate({ p, refund: false })}>Remove only</Button></>
                      : <Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => remove.mutate({ p, refund: false })}>Yes, remove</Button>}<Button size="sm" onClick={() => setRemoving(null)}>Keep</Button></span>
                  : <Button size="sm" onClick={() => setRemoving(p.id)}>Remove</Button>)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading plans…' : 'No plans match.'}</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
