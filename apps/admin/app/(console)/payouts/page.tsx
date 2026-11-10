'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminSample, api, formatNaira, planSaleSplit } from '@/lib/data';
import { Badge, Button, Card, Notice, PageHeader, StatCard } from '@/components/ui';

export default function Payouts() {
  const { data = [] } = useQuery({ queryKey: ['admin', 'payouts'], queryFn: api.admin.payouts });
  const [approved, setApproved] = useState(false);
  const rows = data.map((p) => ({ ...p, ...planSaleSplit(p.gross) }));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
  const gross = sum((r) => r.gross), fee = sum((r) => r.fee);
  const heldRows = rows.filter((r) => r.held);
  const held = heldRows.reduce((t, r) => t + r.sellerGets, 0);
  const paying = gross - fee - held;
  const b = adminSample.payoutBatch;
  return (
    <>
      <PageHeader title="Creator payouts" subtitle={`Next batch: ${b.date} · ${b.window}`}>
        <Button variant="primary" disabled={approved || rows.length === 0} onClick={() => setApproved(true)}>{approved ? 'Batch approved' : `Approve batch · ${formatNaira(paying)}`}</Button>
      </PageHeader>
      <Notice>{approved && `Batch approved. ${formatNaira(paying)} goes to ${rows.length - heldRows.length} sellers' wallets on ${b.date}. ${formatNaira(held)} stays held.`}</Notice>
      <section aria-label="Batch totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Plan sales this week" value={formatNaira(gross)} />
        <StatCard label="Platform fee (25%)" value={formatNaira(fee)} />
        <StatCard label="Paying to sellers" value={formatNaira(paying)} />
        <StatCard label="Held from this batch" value={formatNaira(held)} note={`${heldRows.length} sellers`} alert />
      </section>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Sellers in this batch</caption>
          <thead><tr className="text-xs text-ink-muted">{['Seller', 'Sales', 'Gross', 'Fee 25%', 'Seller gets 75%', 'Status'].map((h, i) => <th key={h} scope="col" className={`border-b border-line px-3 py-2.5 font-semibold ${i > 0 && i < 5 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-3 [&>td]:whitespace-nowrap">
                <td><b className="font-semibold">{r.seller}</b> <span className="text-ink-muted">· #{r.id}</span></td>
                <td className="tnum text-right">{r.sales}</td><td className="tnum text-right">{formatNaira(r.gross)}</td><td className="tnum text-right">{formatNaira(r.fee)}</td>
                <td className="tnum text-right font-semibold">{formatNaira(r.sellerGets)}</td>
                <td>{r.held ? <Badge tone="danger">Held · {r.held}</Badge> : <Badge>{approved ? 'Approved' : 'Ready'}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <section aria-label="Payout rules" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {adminSample.payoutRules.map(([t, d]) => <div key={t} className="rounded-[18px] bg-tint p-4"><b className="text-sm font-semibold text-navy">{t}</b><p className="mt-1 text-[13px] leading-5">{d}</p></div>)}
      </section>
    </>
  );
}
