'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, errorMessage, naira, when } from '@/lib/api';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { accessFor, useSession } from '@/lib/session';

type Status = 'placed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
interface Order { id: string; reference: string; status: Status; customer: string; total: number; paidFromGoal: number; delivery: string; address: string; placedAt: string; items: { name: string; qty: number }[] }
interface Data { counts: Partial<Record<Status, number>>; orders: Order[] }
const stages: [Status, string][] = [['placed', 'To pack'], ['packed', 'Packed'], ['shipped', 'On the way'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
const next: Partial<Record<Status, [Status, string]>> = { placed: ['packed', 'Mark packed'], packed: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] };
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm align-top';

export default function Orders() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'shop') === 'Edit';
  const [stage, setStage] = useState<Status>('placed'); const [notice, setNotice] = useState(''); const [cancelling, setCancelling] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['orders', stage], queryFn: () => adminApi<Data>(`/shop/orders?status=${stage}`) });
  const move = useMutation({
    mutationFn: (v: { o: Order; status: Status }) => adminApi(`/shop/orders/${v.o.id}/status`, { method: 'POST', body: { status: v.status } }),
    onSuccess: (_, v) => { setNotice(v.status === 'cancelled' ? `${v.o.reference} cancelled. ${naira(v.o.total)} went back to the customer's wallet and the stock was returned.` : `${v.o.reference} marked ${v.status}. The customer has been told.`); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (e) => setNotice(errorMessage(e)), onSettled: () => setCancelling(null),
  });
  return (
    <>
      <PageHeader title="Shop orders" subtitle="Orders are paid from the customer's wallet when they are placed" />
      <section aria-label="Order pipeline" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {stages.map(([s, label]) => (
          <button key={s} aria-pressed={stage === s} onClick={() => setStage(s)} className={cn('flex cursor-pointer flex-col rounded-[18px] p-3.5 text-left', stage === s ? 'bg-navy text-white' : 'bg-white')}>
            <b className="tnum text-[22px] font-semibold">{data?.counts[s] ?? 0}</b><span className={cn('text-[13px]', stage !== s && 'text-ink-muted')}>{label}</span>
          </button>
        ))}
      </section>
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full"><caption className="sr-only">Orders</caption>
          <thead><tr>{['Order', 'Customer', 'Items', 'Total', 'Deliver to', 'Placed', ''].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.orders.map((o) => (
              <tr key={o.id}>
                <td className={td}><b className="font-semibold whitespace-nowrap">{o.reference}</b></td><td className={td}>{o.customer}</td>
                <td className={td}>{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</td>
                <td className={`${td} tnum whitespace-nowrap`}>{naira(o.total)}{o.paidFromGoal > 0 && <span className="block text-xs text-ink-muted">{naira(o.paidFromGoal)} from a goal</span>}</td>
                <td className={td}><Badge tone="neutral">{o.delivery}</Badge><span className="mt-1 block max-w-64 text-xs text-ink-muted">{o.address}</span></td>
                <td className={`${td} whitespace-nowrap`}>{when(o.placedAt)}</td>
                <td className={`${td} whitespace-nowrap`}>{canEdit && (cancelling === o.id
                  ? <span className="flex items-center gap-2"><Button size="sm" variant="danger" disabled={move.isPending} onClick={() => move.mutate({ o, status: 'cancelled' })}>Yes, cancel and refund</Button><Button size="sm" onClick={() => setCancelling(null)}>Keep</Button></span>
                  : <span className="flex gap-2">{next[o.status] && <Button size="sm" variant="navy" disabled={move.isPending} onClick={() => move.mutate({ o, status: next[o.status]![0] })}>{next[o.status]![1]}</Button>}{(o.status === 'placed' || o.status === 'packed') && <Button size="sm" onClick={() => setCancelling(o.id)}>Cancel</Button>}</span>)}</td>
              </tr>
            ))}
            {!data?.orders.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading orders…' : 'No orders at this stage.'}</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
