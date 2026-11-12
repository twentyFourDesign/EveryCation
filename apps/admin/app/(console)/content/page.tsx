'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { sample } from '@everycation/shared';
import { adminApi, errorMessage } from '@/lib/api';
import { PhotoField } from '@/components/photo-field';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Textarea } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

interface Place { id: string; uuid: string; name: string; kind: string; countryCode: string; summary: string; bestTime: string | null; currency: string | null; imageUrl: string | null; imageKey: string | null; lat: number | null; lng: number | null; pinned: boolean; published: boolean; tips: number; verifiedAdvice: number }
interface Draft { uuid: string | null; name: string; kind: string; countryCode: string; summary: string; bestTime: string; currency: string; imageUrl: string | null; coords: string; published: boolean }
const kinds = ['City', 'Island', 'Mountains', 'Beach', 'Country', 'Region', 'National park'];
const blank: Draft = { uuid: null, name: '', kind: 'City', countryCode: 'NG', summary: '', bestTime: '', currency: '', imageUrl: null, coords: '', published: true };
/** "-6.1659, 39.2026" → the two numbers, null when left empty, or 'bad' when it is not a latitude and longitude. */
function readCoords(text: string): { lat: number; lng: number } | null | 'bad' {
  if (!text.trim()) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return 'bad';
  const lat = Number(m[1]); const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : 'bad';
}
const country = (code: string) => sample.countries.find((c) => c.code === code)?.name ?? code;
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm whitespace-nowrap';

export default function Content() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'moderation') === 'Edit';
  const [draft, setDraft] = useState<Draft | null>(null); const [notice, setNotice] = useState('');
  const { data = [], isLoading, error } = useQuery({ queryKey: ['places'], queryFn: () => adminApi<Place[]>('/places') });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const coords = draft ? readCoords(draft.coords) : null;
  const invalid = !draft || draft.name.trim().length < 2 || draft.summary.trim().length < 20 || coords === 'bad';
  const save = useMutation({
    mutationFn: (d: Draft) => adminApi(d.uuid ? `/places/${d.uuid}` : '/places', { method: d.uuid ? 'PATCH' : 'POST', body: { ...(d.uuid ? {} : { name: d.name.trim() }), kind: d.kind, countryCode: d.countryCode, summary: d.summary.trim(), bestTime: d.bestTime.trim() || null, currency: d.currency.trim() || null, imageUrl: d.imageUrl, lat: coords && coords !== 'bad' ? coords.lat : null, lng: coords && coords !== 'bad' ? coords.lng : null, published: d.published } }),
    onSuccess: (_, d) => { setNotice(`${d.name} ${d.uuid ? 'saved' : 'added'}.${d.published ? ' It is live in the app.' : ' It is a draft and hidden from the app.'}`); setDraft(null); qc.invalidateQueries({ queryKey: ['places'] }); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Places" subtitle="The place pages travellers open from Explore and search. Tips and advice attach to them by name and country.">
        {canEdit && <Button variant="primary" onClick={() => { setDraft(blank); setNotice(''); }}>+ Add place</Button>}
      </PageHeader>
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      {draft && (
        <form className="flex flex-col gap-4 rounded-card bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (!invalid) save.mutate(draft); }}>
          <h2 className="text-base font-semibold">{draft.uuid ? `Edit ${draft.name}` : 'New place'}</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <Field label="Name" hint={draft.uuid ? 'The name cannot change once tips link to it' : 'Tips that mention this name show on the page'}><Input value={draft.name} disabled={!!draft.uuid} onChange={(e) => set('name', e.target.value)} placeholder="Zanzibar" /></Field>
            <Field label="Kind"><Select value={draft.kind} onChange={(e) => set('kind', e.target.value)}>{[...new Set([...kinds, draft.kind])].map((k) => <option key={k}>{k}</option>)}</Select></Field>
            <Field label="Country"><Select value={draft.countryCode} onChange={(e) => set('countryCode', e.target.value)}>{sample.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select></Field>
            <Field label="Best time to go (optional)"><Input value={draft.bestTime} onChange={(e) => set('bestTime', e.target.value)} placeholder="Jun – Oct" /></Field>
            <Field label="Currency (optional)"><Input value={draft.currency} onChange={(e) => set('currency', e.target.value)} placeholder="Shilling (TZS)" /></Field>
            <Field label="Map position (optional)" error={coords === 'bad' ? 'Enter latitude then longitude, like -6.1659, 39.2026' : undefined} hint="Latitude, longitude. In Google Maps, right-click the spot and click the numbers to copy them. Left empty, the pin sits in the middle of the country."><Input value={draft.coords} onChange={(e) => set('coords', e.target.value)} placeholder="-6.1659, 39.2026" inputMode="text" /></Field>
          </div>
          <Field label="Summary" hint={`${draft.summary.trim().length} characters. At least 20.`}><Textarea rows={2} maxLength={300} value={draft.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Spice farms, white sand and Stone Town's alleys." /></Field>
          <div className="flex flex-wrap items-center gap-6">
            <PhotoField folder="places" value={draft.imageUrl} onChange={(url) => set('imageUrl', url)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} className="size-4 accent-navy" />Published (visible in the app)</label>
          </div>
          <div className="flex gap-2.5"><Button type="submit" variant="navy" disabled={invalid || save.isPending}>{save.isPending ? 'Saving…' : draft.uuid ? 'Save changes' : 'Add place'}</Button><Button onClick={() => setDraft(null)}>Cancel</Button></div>
        </form>
      )}
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full"><caption className="sr-only">Places</caption>
          <thead><tr>{['Place', 'Kind', 'Country', 'Tips', 'Verified advice', 'Photo', 'Map pin', 'Page', ''].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.uuid}>
                <td className={td}><b className="font-semibold">{p.name}</b></td><td className={td}>{p.kind}</td><td className={td}>{country(p.countryCode)}</td><td className={`${td} tnum`}>{p.tips}</td><td className={`${td} tnum`}>{p.verifiedAdvice}</td>
                <td className={td}>{p.imageUrl || p.imageKey ? 'Yes' : <b className="text-danger">Missing</b>}</td>
                <td className={td}>{p.pinned ? 'Yes' : <span className="text-ink-muted">Country centre</span>}</td>
                <td className={td}><Badge tone={p.published ? 'info' : 'warn'}>{p.published ? 'Published' : 'Draft'}</Badge></td>
                <td className={td}>{canEdit && <button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => { setDraft({ uuid: p.uuid, name: p.name, kind: p.kind, countryCode: p.countryCode, summary: p.summary, bestTime: p.bestTime ?? '', currency: p.currency ?? '', imageUrl: p.imageUrl, coords: p.pinned ? `${p.lat}, ${p.lng}` : '', published: p.published }); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>}</td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading places…' : 'No places yet. Add the first one.'}</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
