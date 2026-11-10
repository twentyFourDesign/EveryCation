'use client';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Package } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { adminSample, api, formatNaira } from '@/lib/data';
import { DataTable } from '@/components/data-table';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

type Product = (typeof adminSample.adminProducts)[number];

export default function Products() {
  const { data = [] } = useQuery({ queryKey: ['admin', 'products'], queryFn: api.admin.products });
  const [category, setCategory] = useState('All categories');
  const [notice, setNotice] = useState('');
  const rows = data.filter((p) => category === 'All categories' || p.category === category);
  const columns: ColumnDef<Product>[] = [
    { accessorKey: 'name', header: 'Product', cell: ({ row: { original: p } }) => (
      <span className="flex items-center gap-3">
        {p.image ? <Image src={`/img/${p.image}.jpg`} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" /> : <span className="grid size-10 place-items-center rounded-lg bg-tint text-navy"><Package className="size-5" aria-hidden /></span>}
        <b className="font-semibold">{p.name}</b>
      </span>) },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'price', header: 'Price', meta: { align: 'right' }, cell: ({ getValue }) => formatNaira(getValue<number>()) },
    { accessorKey: 'stock', header: 'Stock', meta: { align: 'right' }, cell: ({ getValue }) => { const s = getValue<number | 'Digital'>(); return typeof s === 'number' && s > 0 && s < 10 ? <b className="text-danger">{s} · low</b> : s; } },
    { accessorKey: 'sold', header: 'Sold (30d)', meta: { align: 'right' } },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge tone={getValue() === 'Live' ? 'info' : 'neutral'}>{getValue<string>()}</Badge> },
    { id: 'action', header: () => <span className="sr-only">Action</span>, enableSorting: false, cell: ({ row: { original: p } }) => { const low = typeof p.stock === 'number' && p.stock < 10; return <button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => setNotice(low ? `Restock request raised for ${p.name}.` : `Opened ${p.name} for editing.`)}>{low ? 'Restock' : 'Edit'}</button>; } },
  ];
  return (
    <>
      <PageHeader title="Shop products" subtitle="486 products in 14 categories · prices in naira">
        <Button onClick={() => setNotice('Choose a CSV with name, category, price in naira and stock.')}>Import CSV</Button>
        <Button variant="primary" onClick={() => setNotice('New product form opened.')}>+ Add product</Button>
      </PageHeader>
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <nav aria-label="Categories" className="flex flex-[1_1_240px] flex-col gap-0.5 rounded-card bg-white p-2.5">
          {[['All categories', 486] as const, ...adminSample.productCategories].map(([name, n]) => (
            <button key={name} aria-current={category === name} onClick={() => setCategory(name)}
              className={cn('flex cursor-pointer justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm', category === name ? 'bg-navy font-semibold text-white' : 'hover:bg-surface-muted')}>
              <span>{name}</span><span className={cn('tnum text-xs', category !== name && 'text-ink-muted')}>{n}</span>
            </button>
          ))}
        </nav>
        <Card className="flex-[4_1_560px] p-2 pb-1"><DataTable caption="Products" data={rows} columns={columns} getRowId={(p) => p.id} empty="No sample products in this category yet." /></Card>
      </div>
    </>
  );
}
