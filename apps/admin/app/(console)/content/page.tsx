'use client';
import Image from 'next/image';
import { useState } from 'react';
import { adminSample } from '@/lib/data';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';

export default function Content() {
  const [notice, setNotice] = useState('');
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const eligible = adminSample.adminPlaces.filter((p) => p.verified >= 10);
  return (
    <>
      <PageHeader title="Places & featured content" subtitle="What travellers see first on Explore, and the place pages behind it">
        <Button variant="primary" onClick={() => setNotice('New place form opened.')}>+ Add place</Button>
      </PageHeader>
      <Notice>{notice}</Notice>
      <Card className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-semibold">Explore this week</h2><span className="text-xs text-ink-muted">Live until Sunday 15 November, 23:59</span></div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {adminSample.featuredSlots.map((s) => (
            <div key={s.slot} className="flex flex-col overflow-hidden rounded-2xl border border-line">
              <Image src={`/img/${s.image}.jpg`} alt="" width={440} height={240} className="h-30 w-full object-cover" />
              <span className="flex flex-col gap-0.5 p-3"><span className="text-[11px] font-semibold tracking-[0.08em] text-heading-blue">{s.slot}</span><b className="text-sm font-semibold">{s.title}</b>
                <button className="cursor-pointer self-start text-xs font-semibold text-heading-blue" onClick={() => setNotice(`Choose a replacement for ${s.slot.toLowerCase()}.`)}>Replace</button></span>
            </div>
          ))}
          <div className="grid min-h-50 place-items-center rounded-2xl border-2 border-dashed border-control-border p-4 text-center">
            <span className="flex flex-col items-center gap-1.5">
              <b className="text-sm font-semibold">Slot 3 · Place spotlight</b>
              {spotlight ? <span className="text-sm">{spotlight}</span> : <span className="text-xs text-ink-muted">Empty. Pick a place with 10+ verified advice.</span>}
              <label className="sr-only" htmlFor="spot">Choose place</label>
              <select id="spot" value={spotlight ?? ''} onChange={(e) => { setSpotlight(e.target.value || null); setNotice(e.target.value ? `${e.target.value} is now the place spotlight.` : ''); }} className="h-9 rounded-full border-[1.5px] border-control-border bg-white px-3 text-xs font-medium">
                <option value="">Choose place</option>{eligible.map((p) => <option key={p.name}>{p.name}</option>)}
              </select>
            </span>
          </div>
        </div>
      </Card>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Places</caption>
          <thead><tr className="text-left text-xs text-ink-muted">{['Place', 'Country', 'Tips', 'Verified advice', 'Photos', 'Page', ''].map((h) => <th key={h} scope="col" className="border-b border-line px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {adminSample.adminPlaces.map((p) => (
              <tr key={p.name} className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-3 [&>td]:whitespace-nowrap">
                <td><b className="font-semibold">{p.name}</b></td><td>{p.country}</td><td className="tnum">{p.tips}</td><td className="tnum">{p.verified}</td><td className="tnum">{p.photos.toLocaleString()}</td>
                <td><Badge tone={p.status === 'Published' ? 'info' : 'warn'}>{p.status}</Badge></td>
                <td><button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => setNotice(`Opened the ${p.name} page for editing.`)}>{p.status === 'Published' ? 'Edit' : 'Finish'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
