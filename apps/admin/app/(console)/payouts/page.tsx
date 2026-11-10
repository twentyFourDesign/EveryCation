'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, errorMessage, naira } from '@/lib/api';
import { Badge, Button, Card, Notice, PageHeader, StatCard } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

interface Seller { sellerId: string; seller: string; sales: number; gross: number; fee: number; owed: number; held: string | null }
interface Batch { sellers: Seller[]; totals: { gross: number; fee: number; paying: number; held: number } }
const rules = [
  ['25% platform fee', 'Taken from every plan sale at checkout. Sellers receive 75%.'],
  ['Paid when Finance approves', "Into the seller's wallet available balance. Run it every Friday."],
  ['Verified ID needed', 'Earnings wait until the seller passes the BVN or NIN check.'],
  ['Straight from the ledger', 'These figures are the unpaid sales in the ledger, not an estimate.'],
];

export default function Payouts() {
  const qc = useQueryClient();
  const canApprove = accessFor(useSession((s) => s.admin)?.role, 'payouts') === 'Edit';
  const [notice, setNotice] = useState(''); const [confirming, setConfirming] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['payouts'], queryFn: () => adminApi<Batch>('/payouts') });
  const approve = useMutation({
    mutationFn: () => adminApi<{ reference: string; sellersPaid: number; total: number; held: number }>('/payouts/approve', { method: 'POST' }),
    onSuccess: (r) => { setNotice(`Batch ${r.reference} paid ${naira(r.total)} to ${r.sellersPaid} seller${r.sellersPaid === 1 ? '' : 's'}.${r.held ? ` ${naira(r.held)} stays held.` : ''}`); qc.invalidateQueries({ queryKey: ['payouts'] }); },
    onError: (e) => setNotice(errorMessage(e)),
    onSettled: () => setConfirming(false),
  });
  const t = data?.totals; const payable = (data?.sellers ?? []).filter((s) => !s.held).length;
  return (
    <>
      <PageHeader title="Creator payouts" subtitle="Trip plan sales that have not been paid to their sellers yet">
        {canApprove && (confirming
          ? <><span className="text-sm">Pay {naira(t?.paying ?? 0)} to {payable} seller{payable === 1 ? '' : 's'}?</span><Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>{approve.isPending ? 'Paying…' : 'Yes, pay now'}</Button><Button onClick={() => setConfirming(false)}>Cancel</Button></>
          : <Button variant="primary" disabled={!t?.paying} onClick={() => setConfirming(true)}>Approve batch · {naira(t?.paying ?? 0)}</Button>)}
      </PageHeader>
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      <section aria-label="Batch totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Unpaid plan sales" value={naira(t?.gross ?? 0)} />
        <StatCard label="Platform fee (25%)" value={naira(t?.fee ?? 0)} />
        <StatCard label="Paying to sellers" value={naira(t?.paying ?? 0)} />
        <StatCard label="Held from this batch" value={naira(t?.held ?? 0)} note={`${(data?.sellers ?? []).filter((s) => s.held).length} sellers`} alert={!!t?.held} />
      </section>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Sellers in this batch</caption>
          <thead><tr className="text-xs text-ink-muted">{['Seller', 'Sales', 'Gross', 'Fee 25%', 'Seller gets 75%', 'Status'].map((h, i) => <th key={h} scope="col" className={`border-b border-line px-3 py-2.5 font-semibold ${i > 0 && i < 5 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.sellers.map((r) => (
              <tr key={r.sellerId} className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-3 [&>td]:whitespace-nowrap">
                <td><b className="font-semibold">{r.seller}</b></td><td className="tnum text-right">{r.sales}</td><td className="tnum text-right">{naira(r.gross)}</td><td className="tnum text-right">{naira(r.fee)}</td>
                <td className="tnum text-right font-semibold">{naira(r.owed)}</td><td>{r.held ? <Badge tone="danger">Held · {r.held}</Badge> : <Badge>Ready</Badge>}</td>
              </tr>
            ))}
            {!data?.sellers.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-muted">{isLoading ? 'Loading the batch…' : 'No unpaid sales. Every seller is up to date.'}</td></tr>}
          </tbody>
        </table>
      </Card>
      <section aria-label="Payout rules" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {rules.map(([title, d]) => <div key={title} className="rounded-[18px] bg-tint p-4"><b className="text-sm font-semibold text-navy">{title}</b><p className="mt-1 text-[13px] leading-5">{d}</p></div>)}
      </section>
    </>
  );
}
