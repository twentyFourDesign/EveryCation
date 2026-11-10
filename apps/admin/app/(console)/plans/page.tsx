'use client';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { adminSample, api, formatNaira } from '@/lib/data';
import { DataTable } from '@/components/data-table';
import { Badge, Button, Card, Chips, Input, Notice, PageHeader } from '@/components/ui';

type Plan = (typeof adminSample.adminPlans)[number];
const filters = adminSample.planFilters;
const statusOf = ['', 'On sale', 'Waiting', 'Free', 'Removed'];

export default function TripPlans() {
  const { data = [] } = useQuery({ queryKey: ['admin', 'plans'], queryFn: api.admin.plans });
  const [filter, setFilter] = useState(filters[0]!);
  const [term, setTerm] = useState('');
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const rows = useMemo(() => data.map((p) => removed.includes(p.id) ? { ...p, status: 'Removed' as const } : p)
    .filter((p) => filter === filters[0] || p.status === statusOf[filters.indexOf(filter)])
    .filter((p) => (p.title + p.seller).toLowerCase().includes(term.toLowerCase())), [data, filter, term, removed]);
  const picked = Object.keys(selection).filter((k) => selection[k]);

  const columns: ColumnDef<Plan>[] = [
    { id: 'select', enableSorting: false, header: () => <span className="sr-only">Select</span>, cell: ({ row }) => <input type="checkbox" aria-label={`Select ${row.original.title}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} className="size-4 accent-navy" /> },
    { accessorKey: 'title', header: 'Plan', cell: ({ row: { original: p } }) => <span className="flex items-center gap-3"><Image src={`/img/${p.image}.jpg`} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" /><b className="font-semibold">{p.title}</b></span> },
    { accessorKey: 'seller', header: 'Seller' },
    { accessorKey: 'price', header: 'Price', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number>() ? formatNaira(getValue<number>()) : 'Free' },
    { accessorKey: 'tripEnds', header: 'Trip ends', enableSorting: false, cell: ({ row: { original: p } }) => <>{p.tripEnds} {p.ended && <span aria-label="trip has ended" className="font-bold text-navy">✓</span>}</> },
    { accessorKey: 'status', header: 'Sale status', cell: ({ row: { original: p } }) => <Badge tone={p.status === 'Waiting' ? 'warn' : p.status.startsWith('Paused') || p.status === 'Removed' ? 'danger' : 'info'}>{p.status === 'Waiting' ? p.opens : p.status}</Badge> },
    { accessorKey: 'sales', header: 'Sales', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number | null>() ?? '—' },
    { accessorKey: 'rating', header: 'Rating', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number | null>() ?? '—' },
    { accessorKey: 'reports', header: 'Reports', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number>() > 0 ? <b className="text-danger">{getValue<number>()}</b> : 0 },
  ];
  return (
    <>
      <PageHeader title="Trip plans" subtitle="3,418 plans · 1,212 sellers · paid plans open for sale only after the seller's trip ends">
        <div className="relative"><Search aria-hidden className="absolute top-3 left-3.5 size-5 text-ink-muted" /><Input aria-label="Search plans" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Plan, seller or destination" className="w-72 max-w-full pl-11" /></div>
      </PageHeader>
      <Chips label="Filter plans" value={filter} onChange={setFilter} options={filters} />
      <Notice>{notice}</Notice>
      <Card className="p-2 pb-1"><DataTable caption="Trip plans" data={rows} columns={columns} getRowId={(p) => p.id} selection={selection} onSelectionChange={setSelection} empty="No plans match." /></Card>
      <div className="flex flex-wrap items-center gap-4 rounded-[18px] bg-tint p-4">
        <div className="flex-[1_1_320px]"><b className="text-sm font-semibold text-navy">How sale dates are set</b><p className="mt-1 text-[13px] leading-5">A paid plan stays in &quot;Waiting for trip to end&quot; until the last day of the seller&apos;s trip on their timeline passes. It opens for sale the next morning at 06:00 WAT and the seller is notified. Free sharing is allowed at any time.</p></div>
        <Button disabled={picked.length !== 1} onClick={() => { setNotice('Plan set as Trip plan of the week on Explore.'); setSelection({}); }}>Feature on Explore</Button>
        <Button variant="danger" disabled={picked.length === 0} onClick={() => { setRemoved((r) => [...r, ...picked]); setNotice(`${picked.length} plan${picked.length > 1 ? 's' : ''} removed. Buyers are refunded before any payout.`); setSelection({}); }}>Remove plan</Button>
      </div>
    </>
  );
}
