'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, colors } from '@/lib/data';
import { Button, Card, PageHeader, Select } from '@/components/ui';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/csv';

export default function Overview() {
  const admin = useSession((s) => s.admin);
  const { data } = useQuery({ queryKey: ['admin', 'overview'], queryFn: api.admin.overview });
  const [period, setPeriod] = useState('Last 4 weeks');
  if (!data) return <p className="text-sm text-ink-muted">Loading the overview…</p>;
  const maxFlow = Math.max(...data.flow.map((f) => f.millions));
  return (
    <>
      <PageHeader title={`Good evening, ${admin?.name.split(' ')[0]}`} subtitle={`${data.date} · ${period.toLowerCase()} compared with the period before`}>
        <label className="sr-only" htmlFor="period">Period</label>
        <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto"><option>Last 4 weeks</option><option>Last 7 days</option><option>This year</option></Select>
        <Button onClick={() => downloadCsv('overview.csv', data.kpis.map((k) => ({ metric: k.label, value: k.value, change: k.delta ?? '' })))}>Export CSV</Button>
      </PageHeader>
      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {data.kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-[18px] bg-white p-4">
            <span className="text-[13px] text-ink-muted">{k.label}</span>
            <b className="tnum text-2xl font-semibold">{k.value}</b>
            {k.delta !== undefined
              ? <span className={k.delta < 0 ? 'text-xs font-semibold text-danger' : 'text-xs font-semibold text-navy'}>{k.delta < 0 ? '▼' : '▲'} {Math.abs(k.delta)}%</span>
              : <span className="text-xs text-ink-muted">{k.note}</span>}
          </div>
        ))}
      </section>
      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Needs attention</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {data.attention.map((a) => (
            <Link key={a.label} href={a.href} className="flex flex-col rounded-2xl border border-line p-3.5 text-ink no-underline hover:border-navy hover:text-ink">
              <b className="tnum text-2xl font-semibold text-navy">{a.count}</b>
              <span className="text-sm font-semibold">{a.label}</span>
              <span className="text-xs text-ink-muted">{a.note}</span>
            </Link>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-base font-semibold">Weekly sign-ups</h2><span className="text-xs text-ink-muted">Weeks starting Monday</span></div>
          <div className="h-60" role="img" aria-label={`Weekly sign-ups rose from ${data.signups[0]!.value} to ${data.signups.at(-1)!.value} over eight weeks`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signups} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.line} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.inkMuted }} />
                <YAxis hide domain={[0, 'dataMax + 100']} />
                <Tooltip cursor={{ fill: colors.surfaceMuted }} formatter={(v) => [Number(v).toLocaleString(), 'Sign-ups']} />
                <Bar dataKey="value" fill={colors.navy} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                  <LabelList dataKey="value" position="top" formatter={(v) => Number(v).toLocaleString()} style={{ fontSize: 12, fill: colors.ink, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="flex flex-col gap-3.5">
          <h2 className="text-base font-semibold">Wallet money flow · 4 weeks</h2>
          {data.flow.map((f) => (
            <div key={f.label} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm"><span>{f.label}</span><b className="tnum font-semibold">₦{f.millions.toFixed(1)}M</b></div>
              <div className="h-2.5 rounded-full bg-surface-muted"><div className="h-full rounded-full bg-sky" style={{ width: `${(f.millions / maxFlow) * 100}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><h2 className="text-base font-semibold">Recent admin activity</h2><Link href="/admins" className="text-[13px] font-semibold no-underline">Full audit log</Link></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-muted">{['Time', 'Admin', 'Action', 'Item'].map((h) => <th key={h} scope="col" className="border-b border-line px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{data.activity.map((r) => <tr key={r.time + r.action}>{[r.time, r.admin, r.action, r.item].map((c, i) => <td key={i} className="border-b border-line px-3 py-3 whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
