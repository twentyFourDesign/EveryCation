'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, errorMessage, naira } from '@/lib/api';
import { PhotoField } from '@/components/photo-field';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, StatCard, Textarea } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

type Plan = 'listing' | 'featured' | 'spotlight';
type Status = 'draft' | 'live' | 'paused';
interface Advertiser { id: string; name: string; kind: string; contactName: string | null; email: string | null; phone: string | null; whatsapp: string | null; website: string | null; sample: boolean; packages: number; live: number }
interface Pkg {
  id: string; title: string; summary: string; destination: string; countryCode: string; countryName: string; nights: number; price: number; priceNote: string; includes: string[]; excludes: string[];
  itinerary: { day: string; title: string; detail: string }[]; vibe: string | null; imageUrl: string | null; plan: Plan; status: Status; running: boolean; adStarts: string; adEnds: string | null;
  travelFrom: string | null; travelTo: string | null; whatsapp: string | null; phone: string | null; website: string | null; advertiser: { id: string; name: string }; sample: boolean;
  stats: { views: number; viewsLast30: number; enquiries: number; whatsapp: number; call: number; websiteClicks: number; saves: number; enquiryRate: number };
}
interface Draft { id: string | null; advertiserId: string; title: string; summary: string; destination: string; countryCode: string; nights: string; price: string; priceNote: string; includes: string; excludes: string; itinerary: string; vibe: string; imageUrl: string | null; plan: Plan; status: Status; adStarts: string; adEnds: string; travelFrom: string; travelTo: string; whatsapp: string; phone: string; website: string }

const PLANS: { value: Plan; label: string; where: string }[] = [
  { value: 'spotlight', label: 'Spotlight', where: 'Top of Explore, first in Packages and on matching destinations' },
  { value: 'featured', label: 'Featured', where: 'Explore carousel and near the top of Packages' },
  { value: 'listing', label: 'Listing', where: 'Packages and matching destinations' },
];
const VIBES = ['beach', 'city', 'adventure', 'food', 'culture', 'nature'];
const today = () => new Date().toISOString().slice(0, 10);
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const blank = (advertiserId = ''): Draft => ({ id: null, advertiserId, title: '', summary: '', destination: '', countryCode: '', nights: '3', price: '', priceNote: 'per person sharing', includes: '', excludes: '', itinerary: '', vibe: '', imageUrl: null, plan: 'listing', status: 'draft', adStarts: today(), adEnds: '', travelFrom: '', travelTo: '', whatsapp: '', phone: '', website: '' });
const toDraft = (p: Pkg): Draft => ({ id: p.id, advertiserId: p.advertiser.id, title: p.title, summary: p.summary, destination: p.destination, countryCode: p.countryCode, nights: String(p.nights), price: String(p.price / 100), priceNote: p.priceNote,
  includes: p.includes.join('\n'), excludes: p.excludes.join('\n'), itinerary: p.itinerary.map((d) => [d.day, d.title, d.detail].join(' | ')).join('\n'), vibe: p.vibe ?? '', imageUrl: p.imageUrl, plan: p.plan, status: p.status,
  adStarts: p.adStarts, adEnds: p.adEnds ?? '', travelFrom: p.travelFrom ?? '', travelTo: p.travelTo ?? '', whatsapp: p.whatsapp ?? '', phone: p.phone ?? '', website: p.website ?? '' });
const stateOf = (p: Pkg) => (p.status === 'draft' ? ['Draft', 'neutral'] : p.status === 'paused' ? ['Paused', 'neutral'] : p.running ? ['Running', 'info'] : p.adStarts > today() ? ['Scheduled', 'warn'] : ['Ended', 'danger']) as [string, 'neutral' | 'info' | 'warn' | 'danger'];
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm align-top';

function AdvertiserForm({ onDone }: { onDone: (msg: string) => void }) {
  const qc = useQueryClient();
  const [a, setA] = useState({ name: '', kind: 'agency', contactName: '', email: '', phone: '', whatsapp: '', website: '' });
  const save = useMutation({ mutationFn: () => adminApi('/advertisers', { method: 'POST', body: a }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['advertisers'] }); onDone(`${a.name} added. Now add their first package.`); }, onError: (e) => onDone(errorMessage(e)) });
  const set = (k: keyof typeof a, v: string) => setA((x) => ({ ...x, [k]: v }));
  return (
    <form className="flex flex-col gap-4 rounded-card bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (a.name.trim().length >= 2) save.mutate(); }}>
      <h2 className="text-base font-semibold">New advertiser</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Field label="Company name"><Input value={a.name} onChange={(e) => set('name', e.target.value)} placeholder="Coastline Tours Ltd" /></Field>
        <Field label="Type"><Select value={a.kind} onChange={(e) => set('kind', e.target.value)}><option value="agency">Travel agency</option><option value="hotel">Hotel or resort</option><option value="tour_operator">Tour operator</option><option value="other">Other</option></Select></Field>
        <Field label="Contact person"><Input value={a.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={a.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone for calls" hint="0803… or +234…"><Input value={a.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="WhatsApp" hint="Travellers enquire here"><Input value={a.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
        <Field label="Website" hint="Full address, https://…"><Input value={a.website} onChange={(e) => set('website', e.target.value)} /></Field>
      </div>
      <div className="flex gap-2.5"><Button type="submit" variant="navy" disabled={a.name.trim().length < 2 || save.isPending}>{save.isPending ? 'Saving…' : 'Add advertiser'}</Button><Button onClick={() => onDone('')}>Cancel</Button></div>
    </form>
  );
}

export default function Packages() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'ads') === 'Edit';
  const [draft, setDraft] = useState<Draft | null>(null); const [addingAdvertiser, setAddingAdvertiser] = useState(false); const [notice, setNotice] = useState('');
  const pkgs = useQuery({ queryKey: ['packages'], queryFn: () => adminApi<Pkg[]>('/packages') });
  const ads = useQuery({ queryKey: ['advertisers'], queryFn: () => adminApi<Advertiser[]>('/advertisers') });
  const data = pkgs.data ?? []; const running = data.filter((p) => p.running);
  const views30 = data.reduce((n, p) => n + p.stats.viewsLast30, 0); const enquiries = data.reduce((n, p) => n + p.stats.enquiries, 0); const views = data.reduce((n, p) => n + p.stats.views, 0);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const price = Number(draft?.price.replace(/[₦,\s]/g, ''));
  const invalid = !draft || !draft.advertiserId || draft.title.trim().length < 4 || draft.destination.trim().length < 2 || !/^[A-Za-z]{2}$/.test(draft.countryCode) || !(price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.adStarts);
  const save = useMutation({
    mutationFn: (d: Draft) => adminApi(d.id ? `/packages/${d.id}` : '/packages', { method: d.id ? 'PATCH' : 'POST', body: {
      advertiserId: d.advertiserId, title: d.title.trim(), summary: d.summary.trim(), destination: d.destination.trim(), countryCode: d.countryCode, nights: Number(d.nights) || 0, price: Math.round(price * 100), priceNote: d.priceNote.trim(),
      includes: lines(d.includes), excludes: lines(d.excludes), itinerary: lines(d.itinerary).map((l) => { const [day = '', title = '', detail = ''] = l.split('|').map((x) => x.trim()); return { day, title: title || day, detail }; }),
      ...(d.vibe && { vibe: d.vibe }), ...(d.imageUrl && { imageUrl: d.imageUrl }), plan: d.plan, status: d.status, adStarts: d.adStarts, adEnds: d.adEnds || null, travelFrom: d.travelFrom || null, travelTo: d.travelTo || null,
      whatsapp: d.whatsapp, phone: d.phone, website: d.website,
    } }),
    onSuccess: (_, d) => { setNotice(`${d.title} ${d.id ? 'saved' : 'added'}.`); setDraft(null); qc.invalidateQueries({ queryKey: ['packages'] }); qc.invalidateQueries({ queryKey: ['advertisers'] }); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (p: Pkg) => adminApi(`/packages/${p.id}`, { method: 'PATCH', body: { status: p.status === 'live' ? 'paused' : 'live' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }), onError: (e) => setNotice(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Packages & ads" subtitle="Travel packages that agencies, hotels and tour companies pay to show in the app">
        {canEdit && <><Button onClick={() => { setAddingAdvertiser(true); setDraft(null); setNotice(''); }}>+ Advertiser</Button><Button variant="primary" onClick={() => { setDraft(blank(ads.data?.[0]?.id)); setAddingAdvertiser(false); setNotice(''); }}>+ Add package</Button></>}
      </PageHeader>
      <Notice>{notice || (pkgs.error ? errorMessage(pkgs.error) : '')}</Notice>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <StatCard label="Packages running" value={running.length} note={`${data.length} in total`} />
        <StatCard label="Views, last 30 days" value={views30.toLocaleString()} />
        <StatCard label="Enquiries" value={enquiries.toLocaleString()} note="WhatsApp, calls and website taps" />
        <StatCard label="Enquiry rate" value={`${views ? Math.round((enquiries / views) * 1000) / 10 : 0}%`} note="Enquiries per view" />
      </div>
      {addingAdvertiser && <AdvertiserForm onDone={(m) => { setAddingAdvertiser(false); setNotice(m); }} />}
      {draft && (
        <form className="flex flex-col gap-4 rounded-card bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (!invalid) save.mutate(draft); }}>
          <h2 className="text-base font-semibold">{draft.id ? 'Edit package' : 'New package'}</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <Field label="Advertiser"><Select value={draft.advertiserId} onChange={(e) => set('advertiserId', e.target.value)}><option value="">Choose…</option>{ads.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Title"><Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Zanzibar Beach Escape" /></Field>
            <Field label="Destination"><Input value={draft.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Zanzibar, Tanzania" /></Field>
            <Field label="Country code" hint="Two letters, e.g. TZ. Links the visa rules."><Input value={draft.countryCode} maxLength={2} onChange={(e) => set('countryCode', e.target.value.toUpperCase())} /></Field>
            <Field label="Nights"><Input inputMode="numeric" value={draft.nights} onChange={(e) => set('nights', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Price from (₦)"><Input inputMode="numeric" value={draft.price} onChange={(e) => set('price', e.target.value)} placeholder="1850000" /></Field>
            <Field label="Price covers"><Input value={draft.priceNote} onChange={(e) => set('priceNote', e.target.value)} placeholder="per person sharing, flights included" /></Field>
            <Field label="Vibe"><Select value={draft.vibe} onChange={(e) => set('vibe', e.target.value)}><option value="">None</option>{VIBES.map((v) => <option key={v} value={v}>{v[0]!.toUpperCase() + v.slice(1)}</option>)}</Select></Field>
          </div>
          <Field label="Summary"><Textarea rows={2} value={draft.summary} maxLength={400} onChange={(e) => set('summary', e.target.value)} /></Field>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            <Field label="Included" hint="One per line"><Textarea rows={5} value={draft.includes} onChange={(e) => set('includes', e.target.value)} /></Field>
            <Field label="Not included" hint="One per line"><Textarea rows={5} value={draft.excludes} onChange={(e) => set('excludes', e.target.value)} /></Field>
          </div>
          <Field label="Plan, day by day" hint="One line a day: Day 1 | Title | What happens"><Textarea rows={5} value={draft.itinerary} onChange={(e) => set('itinerary', e.target.value)} placeholder="Day 1 | Fly to Zanzibar | Lagos to Zanzibar via Nairobi, then transfer to Nungwi." /></Field>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <Field label="Ad plan" hint={PLANS.find((p) => p.value === draft.plan)?.where}><Select value={draft.plan} onChange={(e) => set('plan', e.target.value as Plan)}>{PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></Field>
            <Field label="Status"><Select value={draft.status} onChange={(e) => set('status', e.target.value as Status)}><option value="draft">Draft</option><option value="live">Live</option><option value="paused">Paused</option></Select></Field>
            <Field label="Ad starts"><Input type="date" value={draft.adStarts} onChange={(e) => set('adStarts', e.target.value)} /></Field>
            <Field label="Ad ends" hint="Empty runs until paused"><Input type="date" value={draft.adEnds} onChange={(e) => set('adEnds', e.target.value)} /></Field>
            <Field label="Travel from (optional)"><Input type="date" value={draft.travelFrom} onChange={(e) => set('travelFrom', e.target.value)} /></Field>
            <Field label="Travel until (optional)"><Input type="date" value={draft.travelTo} onChange={(e) => set('travelTo', e.target.value)} /></Field>
            <Field label="WhatsApp for this package" hint="Empty uses the advertiser's"><Input value={draft.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
            <Field label="Booking page" hint="Empty uses the advertiser's website"><Input value={draft.website} onChange={(e) => set('website', e.target.value)} /></Field>
          </div>
          <PhotoField folder="packages" value={draft.imageUrl} onChange={(url) => set('imageUrl', url)} />
          <div className="flex gap-2.5"><Button type="submit" variant="navy" disabled={invalid || save.isPending}>{save.isPending ? 'Saving…' : draft.id ? 'Save changes' : 'Add package'}</Button><Button onClick={() => setDraft(null)}>Cancel</Button></div>
        </form>
      )}
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full"><caption className="sr-only">Packages</caption>
          <thead><tr>{['Package', 'Plan', 'Ad dates', 'Status', 'Views', 'Enquiries', 'Saves', 'Rate', ''].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data.map((p) => { const [label, tone] = stateOf(p); return (
              <tr key={p.id}>
                <td className={td}><b className="font-semibold">{p.title}</b>{p.sample && <Badge tone="neutral" className="ml-2">Sample</Badge>}<div className="text-xs text-ink-muted">{p.advertiser.name} · {p.destination} · {naira(p.price)}</div></td>
                <td className={td}><Badge tone={p.plan === 'spotlight' ? 'navy' : p.plan === 'featured' ? 'warn' : 'info'}>{PLANS.find((x) => x.value === p.plan)?.label}</Badge></td>
                <td className={`${td} tnum whitespace-nowrap text-xs`}>{p.adStarts}<br />{p.adEnds ? `to ${p.adEnds}` : 'no end date'}</td>
                <td className={td}><Badge tone={tone}>{label}</Badge></td>
                <td className={`${td} tnum`}>{p.stats.views}<div className="text-xs text-ink-muted">{p.stats.viewsLast30} in 30d</div></td>
                <td className={`${td} tnum`}>{p.stats.enquiries}<div className="text-xs text-ink-muted whitespace-nowrap">{p.stats.whatsapp} WA · {p.stats.call} call · {p.stats.websiteClicks} web</div></td>
                <td className={`${td} tnum`}>{p.stats.saves}</td>
                <td className={`${td} tnum`}>{p.stats.enquiryRate}%</td>
                <td className={`${td} whitespace-nowrap`}>{canEdit && <span className="flex gap-3">
                  <button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => { setDraft(toDraft(p)); setAddingAdvertiser(false); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  {p.status !== 'draft' && <button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => toggle.mutate(p)}>{p.status === 'live' ? 'Pause' : 'Go live'}</button>}
                </span>}</td>
              </tr>
            ); })}
            {!data.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-ink-muted">{pkgs.isLoading ? 'Loading packages…' : 'No packages yet. Add an advertiser, then their first package.'}</td></tr>}
          </tbody>
        </table>
      </Card>
      {!!ads.data?.length && (
        <Card className="overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="px-3 py-2 text-left text-sm font-semibold">Advertisers</caption>
            <thead><tr>{['Advertiser', 'Type', 'Contact', 'Packages'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>{ads.data.map((a) => (
              <tr key={a.id}>
                <td className={td}><b className="font-semibold">{a.name}</b>{a.sample && <Badge tone="neutral" className="ml-2">Sample</Badge>}</td>
                <td className={td}>{{ agency: 'Travel agency', hotel: 'Hotel or resort', tour_operator: 'Tour operator', other: 'Other' }[a.kind] ?? a.kind}</td>
                <td className={`${td} text-xs`}>{[a.contactName, a.email, a.whatsapp ?? a.phone].filter(Boolean).join(' · ') || '—'}</td>
                <td className={`${td} tnum`}>{a.live} live of {a.packages}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
