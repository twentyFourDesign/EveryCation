'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { adminApi, errorMessage, naira, when } from '@/lib/api';
import { Badge, Button, Card, Chips, Input, Notice, PageHeader } from '@/components/ui';
import { noWhy, ReasonPicker, whyBody, whyReady, type Why } from '@/components/reason-picker';
import { accessFor, useSession } from '@/lib/session';

type Status = 'on_sale' | 'scheduled' | 'free' | 'removed';
interface Plan { id: string; title: string; place: string; days: number; stops: number; price: number; status: Status; opensAt: string | null; used: number; author: { name: string }; removedReason: string | null }
const filters = [{ value: 'all', label: 'All' }, { value: 'on_sale', label: 'On sale' }, { value: 'scheduled', label: 'Waiting for trip to end' }, { value: 'free', label: 'Free' }, { value: 'removed', label: 'Removed' }] as const;
const label: Record<Status, string> = { on_sale: 'On sale', scheduled: 'Waiting', free: 'Free', removed: 'Removed' };
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm align-top';

export default function TripPlans() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'plans') === 'Edit';
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all'); const [term, setTerm] = useState(''); const [notice, setNotice] = useState(''); const [removing, setRemoving] = useState<string | null>(null); const [why, setWhy] = useState<Why>(noWhy);
  const { data = [], isLoading, error } = useQuery({ queryKey: ['plans'], queryFn: () => adminApi<Plan[]>('/plans') });
  const remove = useMutation({
    mutationFn: (v: { p: Plan; refund: boolean }) => adminApi<{ refunded: number; total: number; alreadyPaidOut: number }>(`/plans/${v.p.id}/remove`, { method: 'POST', body: { refund: v.refund, ...whyBody(why) } }),
    onSuccess: (r, v) => { setNotice(`"${v.p.title}" removed and the seller told.${r.refunded ? ` ${naira(r.total)} went back to ${r.refunded} buyer${r.refunded === 1 ? '' : 's'}.` : ''}${r.alreadyPaidOut ? ` ${r.alreadyPaidOut} sale${r.alreadyPaidOut === 1 ? ' was' : 's were'} already paid out to the seller and not refunded.` : ''}`); qc.invalidateQueries({ queryKey: ['plans'] }); },
    onError: (e) => setNotice(errorMessage(e)), onSettled: () => { setRemoving(null); setWhy(noWhy); },
  });
  const rows = data.filter((p) => filter === 'all' || p.status === filter).filter((p) => `${p.title} ${p.place} ${p.author.name}`.toLowerCase().includes(term.toLowerCase()));
  const target = data.find((p) => p.id === removing);
  return (
    <>
      <PageHeader title="Trip plans" subtitle="Paid plans go on sale at 6:00 am the day after the trip ends">
        <div className="relative"><Search aria-hidden className="absolute top-3 left-3.5 size-5 text-ink-muted" /><Input aria-label="Search plans" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Plan, place or seller" className="w-72 max-w-full pl-11" /></div>
      </PageHeader>
      <Chips label="Filter plans" value={filter} onChange={setFilter} options={filters} />
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      {target && (
        <Card className="flex flex-col gap-4">
          <div><h2 className="text-base font-semibold">Remove &ldquo;{target.title}&rdquo;</h2><p className="text-sm text-ink-muted">By {target.author.name}. It comes off the marketplace and the seller is told why.{target.price > 0 && target.used > 0 ? ` ${target.used} traveller${target.used === 1 ? ' has' : 's have'} bought it.` : ''}</p></div>
          <div className="max-w-xl"><ReasonPicker value={why} onChange={setWhy} /></div>
          <div className="flex flex-wrap gap-2">
            {target.price > 0 && target.used > 0
              ? <><Button variant="danger" disabled={remove.isPending || !whyReady(why)} onClick={() => remove.mutate({ p: target, refund: true })}>Remove and refund buyers</Button><Button disabled={remove.isPending || !whyReady(why)} onClick={() => remove.mutate({ p: target, refund: false })}>Remove only</Button></>
              : <Button variant="danger" disabled={remove.isPending || !whyReady(why)} onClick={() => remove.mutate({ p: target, refund: false })}>Remove plan</Button>}
            <Button onClick={() => setRemoving(null)}>Keep it</Button>
          </div>
        </Card>
      )}
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
                <td className={td}><Badge tone={p.status === 'removed' ? 'danger' : p.status === 'on_sale' ? 'info' : 'neutral'}>{label[p.status]}</Badge>{p.opensAt && <span className="mt-1 block text-xs text-ink-muted">Opens {when(p.opensAt)}</span>}{p.removedReason && <span className="mt-1 block max-w-56 text-xs whitespace-normal text-ink-muted">{p.removedReason}</span>}</td>
                <td className={`${td} whitespace-nowrap`}>{canEdit && p.status !== 'removed' && <Button size="sm" onClick={() => { setRemoving(p.id); setWhy(noWhy); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Remove</Button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading plans…' : 'No plans match.'}</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
