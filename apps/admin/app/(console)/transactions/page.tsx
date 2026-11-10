'use client';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { adminSample, api, formatNaira } from '@/lib/data';
import { DataTable } from '@/components/data-table';
import { Badge, Button, Card, Chips, Notice, PageHeader, StatCard } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';
import { accessFor, useSession } from '@/lib/session';

type Row = (typeof adminSample.ledger)[number];
const kinds = ['All', 'Deposits', 'Withdrawals', 'Purchases', 'Payouts & fees'] as const;

export default function Transactions() {
  const canEdit = accessFor(useSession((s) => s.admin)!.role, 'wallet') === 'Edit';
  const { data: held = [] } = useQuery({ queryKey: ['admin', 'held'], queryFn: api.admin.heldWithdrawals });
  const { data: ledger = [] } = useQuery({ queryKey: ['admin', 'ledger'], queryFn: api.admin.ledger });
  const [kind, setKind] = useState<(typeof kinds)[number]>('All');
  const [resolved, setResolved] = useState<Record<string, 'Released' | 'Still held'>>({});
  const [notice, setNotice] = useState('');
  const rows = ledger.filter((r) => kind === 'All' || r.kind === kind);
  const columns: ColumnDef<Row>[] = [
    { accessorKey: 'time', header: 'Time' },
    { accessorKey: 'ref', header: 'Reference', cell: ({ getValue }) => <b className="font-semibold">{getValue<string>()}</b> },
    { accessorKey: 'user', header: 'User' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'amount', header: 'Amount', meta: { align: 'right' }, cell: ({ getValue }) => formatNaira(getValue<number>(), { sign: true }) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge tone={getValue() === 'Processing' ? 'warn' : 'info'}>{getValue<string>()}</Badge> },
  ];
  return (
    <>
      <PageHeader title="Wallet & withdrawals" subtitle="Customer money held with [payments partner] · reconciled 22:00 today">
        <Button onClick={() => downloadCsv('ledger.csv', rows.map((r) => ({ time: r.time, reference: r.ref, user: r.user, type: r.type, amount_naira: r.amount / 100, status: r.status })))}>Download ledger</Button>
      </PageHeader>
      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">{adminSample.walletTotals.map((t) => <StatCard key={t.label} {...t} />)}</section>
      <Notice>{notice}</Notice>
      <Card className="flex flex-col gap-2">
        <div><h2 className="text-base font-semibold">Withdrawals on hold</h2><p className="text-xs text-ink-muted">Held automatically: over the daily limit, a new bank account, or unusual activity</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-muted">{['User', 'Amount', 'To', 'Why held', 'Waiting', 'Action'].map((h) => <th key={h} scope="col" className="border-b border-line px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {held.map((h) => (
                <tr key={h.id} className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-3 [&>td]:whitespace-nowrap">
                  <td><b className="font-semibold">{h.user}</b></td><td className="tnum">{formatNaira(h.amount)}</td>
                  <td>{h.to} {h.isNew && <Badge tone="warn">new</Badge>}</td><td>{h.why}</td><td>{h.waiting}</td>
                  <td>{resolved[h.id] ? <Badge tone={resolved[h.id] === 'Released' ? 'info' : 'neutral'}>{resolved[h.id]}</Badge> : canEdit ? (
                    <span className="flex gap-2">
                      <Button size="sm" variant="navy" onClick={() => { setResolved((s) => ({ ...s, [h.id]: 'Released' })); setNotice(`Released ${formatNaira(h.amount)} to ${h.to}.`); }}>Release</Button>
                      <Button size="sm" onClick={() => { setResolved((s) => ({ ...s, [h.id]: 'Still held' })); setNotice(`${h.user} stays on hold. The user has been told why.`); }}>Keep holding</Button>
                    </span>) : 'View only'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Ledger</h2><Chips label="Ledger type" value={kind} onChange={setKind} options={kinds} /></div>
        <DataTable caption="Ledger" data={rows} columns={columns} getRowId={(r) => r.ref} empty="No entries of this type today." />
      </Card>
    </>
  );
}
