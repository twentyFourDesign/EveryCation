'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminSample } from '@/lib/data';
import { adminApi, errorMessage, naira } from '@/lib/api';
import { PhotoField } from '@/components/photo-field';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { accessFor, useSession } from '@/lib/session';

interface Product { id: string; name: string; brand: string | null; category: string; price: number; stock: number | null; variant: string | null; description: string; pickedNote: string | null; imageUrl: string | null; active: boolean; sold30d: number }
interface Draft { id: string | null; name: string; brand: string; category: string; price: string; digital: boolean; stock: string; variant: string; description: string; pickedNote: string; imageUrl: string | null; active: boolean }
const categories = adminSample.productCategories.map(([c]) => c).filter((c) => c !== 'Picked by travellers');
const blank: Draft = { id: null, name: '', brand: '', category: categories[0]!, price: '', digital: false, stock: '0', variant: '', description: '', pickedNote: '', imageUrl: null, active: true };
const toDraft = (p: Product): Draft => ({ id: p.id, name: p.name, brand: p.brand ?? '', category: p.category, price: String(p.price / 100), digital: p.stock === null, stock: String(p.stock ?? 0), variant: p.variant ?? '', description: p.description, pickedNote: p.pickedNote ?? '', imageUrl: p.imageUrl, active: p.active });
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm';

export default function Products() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'shop') === 'Edit';
  const [category, setCategory] = useState('All categories'); const [draft, setDraft] = useState<Draft | null>(null); const [notice, setNotice] = useState('');
  const { data = [], isLoading, error } = useQuery({ queryKey: ['products'], queryFn: () => adminApi<Product[]>('/shop/products') });
  const rows = data.filter((p) => category === 'All categories' || p.category === category);
  const count = (c: string) => data.filter((p) => p.category === c).length;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const price = Number(draft?.price.replace(/[₦,\s]/g, '')); const stock = Number(draft?.stock);
  const invalid = !draft || draft.name.trim().length < 2 || !(price > 0) || (!draft.digital && !(Number.isInteger(stock) && stock >= 0));
  const save = useMutation({
    mutationFn: (d: Draft) => adminApi(d.id ? `/shop/products/${d.id}` : '/shop/products', { method: d.id ? 'PATCH' : 'POST', body: { name: d.name.trim(), brand: d.brand.trim() || null, category: d.category, price: Math.round(price * 100), stock: d.digital ? null : stock, variant: d.variant.trim() || null, description: d.description.trim(), pickedNote: d.pickedNote.trim() || null, imageUrl: d.imageUrl, active: d.active } }),
    onSuccess: (_, d) => { setNotice(`${d.name} ${d.id ? 'saved' : 'added to the shop'}.`); setDraft(null); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Shop products" subtitle={`${data.filter((p) => p.active).length} live products · prices in naira`}>
        {canEdit && <Button variant="primary" onClick={() => { setDraft(blank); setNotice(''); }}>+ Add product</Button>}
      </PageHeader>
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      {draft && (
        <form className="flex flex-col gap-4 rounded-card bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (!invalid) save.mutate(draft); }}>
          <h2 className="text-base font-semibold">{draft.id ? 'Edit product' : 'New product'}</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <Field label="Name"><Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Dakota backpack, medium" /></Field>
            <Field label="Brand (optional)"><Input value={draft.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label="Category"><Select value={draft.category} onChange={(e) => set('category', e.target.value)}>{[...new Set([...categories, draft.category])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Price (₦)"><Input inputMode="numeric" value={draft.price} onChange={(e) => set('price', e.target.value)} placeholder="95000" /></Field>
            <Field label="Stock" hint={draft.digital ? 'Digital items never run out' : undefined}><Input inputMode="numeric" disabled={draft.digital} value={draft.digital ? '' : draft.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
            <Field label="Colour or size (optional)"><Input value={draft.variant} onChange={(e) => set('variant', e.target.value)} placeholder="Navy" /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={600} /></Field>
          <Field label={'"Picked by travellers" note (optional)'}><Input value={draft.pickedNote} onChange={(e) => set('pickedNote', e.target.value)} placeholder="Mentioned in 4 tips about carry-on packing." /></Field>
          <div className="flex flex-wrap items-center gap-6">
            <PhotoField folder="products" value={draft.imageUrl} onChange={(url) => set('imageUrl', url)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.digital} onChange={(e) => set('digital', e.target.checked)} className="size-4 accent-navy" />Digital item (sent by email)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} className="size-4 accent-navy" />Show in the shop</label>
          </div>
          <div className="flex gap-2.5"><Button type="submit" variant="navy" disabled={invalid || save.isPending}>{save.isPending ? 'Saving…' : draft.id ? 'Save changes' : 'Add product'}</Button><Button onClick={() => setDraft(null)}>Cancel</Button></div>
        </form>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <nav aria-label="Categories" className="flex flex-[1_1_240px] flex-col gap-0.5 rounded-card bg-white p-2.5">
          {['All categories', ...categories].map((name) => (
            <button key={name} aria-current={category === name} onClick={() => setCategory(name)} className={cn('flex cursor-pointer justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm', category === name ? 'bg-navy font-semibold text-white' : 'hover:bg-surface-muted')}>
              <span>{name}</span><span className={cn('tnum text-xs', category !== name && 'text-ink-muted')}>{name === 'All categories' ? data.length : count(name)}</span>
            </button>
          ))}
        </nav>
        <Card className="flex-[4_1_560px] overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="sr-only">Products</caption>
            <thead><tr>{['Product', 'Category', 'Price', 'Stock', 'Sold (30d)', 'Status', ''].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className={td}><span className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-10 rounded-lg object-cover" /> : <span className="size-10 rounded-lg bg-tint" />}<b className="font-semibold">{p.brand ? `${p.brand} ` : ''}{p.name}</b></span></td>
                  <td className={td}>{p.category}</td><td className={`${td} tnum whitespace-nowrap`}>{naira(p.price)}</td>
                  <td className={`${td} tnum whitespace-nowrap`}>{p.stock === null ? 'Digital' : p.stock === 0 ? <b className="text-danger">Sold out</b> : p.stock < 10 ? <b className="text-danger">{p.stock} · low</b> : p.stock}</td>
                  <td className={`${td} tnum`}>{p.sold30d}</td><td className={td}><Badge tone={p.active ? 'info' : 'neutral'}>{p.active ? 'Live' : 'Hidden'}</Badge></td>
                  <td className={td}>{canEdit && <button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => { setDraft(toDraft(p)); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading products…' : 'No products in this category yet.'}</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
