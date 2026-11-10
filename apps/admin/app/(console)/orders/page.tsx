'use client';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';
import { adminSample, api, formatNaira } from '@/lib/data';
import { DataTable } from '@/components/data-table';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

type Order = (typeof adminSample.adminOrders)[number];

export default function Orders() {
  const { data = [] } = useQuery({ queryKey: ['admin', 'orders'], queryFn: api.admin.orders });
  const [stage, setStage] = useState('To dispatch');
  const [selection, setSelection] = useState<RowSelectionState>({ 'EC-SH-20981': true, 'EC-SH-20977': true });
  const [shipped, setShipped] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const all = data.map((o) => shipped.includes(o.id) ? { ...o, status: 'Shipped' } : o);
  const rows = all.filter((o) => stage === 'To dispatch' ? ['To dispatch', 'eSIM sent', 'Out for delivery'].includes(o.status) : o.status === stage);
  const picked = Object.keys(selection).filter((k) => selection[k]);
  const columns: ColumnDef<Order>[] = [
    { id: 'select', enableSorting: false,
      header: ({ table }) => <input type="checkbox" aria-label="Select all orders" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} className="size-4 accent-navy" />,
      cell: ({ row }) => <input type="checkbox" aria-label={`Select order ${row.original.id}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} className="size-4 accent-navy" /> },
    { accessorKey: 'id', header: 'Order', cell: ({ getValue }) => <b className="font-semibold">{getValue<string>()}</b> },
    { accessorKey: 'customer', header: 'Customer' },
    { accessorKey: 'items', header: 'Items', meta: { align: 'right' } },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right' }, cell: ({ getValue }) => formatNaira(getValue<number>()) },
    { accessorKey: 'paidWith', header: 'Paid with', enableSorting: false },
    { accessorKey: 'deliverBy', header: 'Deliver by', enableSorting: false, cell: ({ row: { original: o } }) => <span className={cn(o.urgent && 'font-semibold text-danger')}>{o.deliverBy}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => { const s = getValue<string>(); return <Badge tone={s === 'To dispatch' ? 'warn' : s === 'Out for delivery' ? 'neutral' : 'info'}>{s}</Badge>; } },
  ];
  const toDispatch = 23 - shipped.length;
  return (
    <>
      <PageHeader title="Shop orders" subtitle={'Orders flagged "travelling soon" ship first'}>
        <Button variant="primary" onClick={() => window.print()}>Print packing slips ({toDispatch})</Button>
      </PageHeader>
      <section aria-label="Order pipeline" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {adminSample.orderPipeline.map((p) => {
          const count = p.label === 'To dispatch' ? toDispatch : p.label === 'Shipped' ? p.count + shipped.length : p.count;
          return (
            <button key={p.label} aria-pressed={stage === p.label} onClick={() => setStage(p.label)}
              className={cn('flex cursor-pointer flex-col rounded-[18px] p-3.5 text-left', stage === p.label ? 'bg-navy text-white' : p.alert ? 'bg-danger-soft' : 'bg-white')}>
              <b className="tnum text-[22px] font-semibold">{count}</b><span className={cn('text-[13px]', stage !== p.label && !p.alert && 'text-ink-muted')}>{p.label}</span>
            </button>
          );
        })}
      </section>
      <Notice>{notice}</Notice>
      <Card className="p-2 pb-1"><DataTable caption="Orders" data={rows} columns={columns} getRowId={(o) => o.id} selection={selection} onSelectionChange={setSelection} empty="No sample orders at this stage." /></Card>
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[18px] bg-white px-4.5 py-3.5">
          <span className="text-sm font-semibold">{picked.length} order{picked.length > 1 && 's'} selected</span>
          <Button size="sm" variant="navy" onClick={() => { setShipped((s) => [...s, ...picked]); setNotice(`${picked.length} order${picked.length > 1 ? 's' : ''} marked as shipped. Customers have been notified.`); setSelection({}); }}>Mark as shipped</Button>
          <Button size="sm" onClick={() => setNotice('Add a tracking number for each selected order.')}>Add tracking numbers</Button>
          <Button size="sm" onClick={() => setNotice('Message drafted to the selected customers.')}>Message customers</Button>
        </div>
      )}
    </>
  );
}
