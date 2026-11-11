'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi, errorMessage, naira, when } from '@/lib/api';
import { colors } from '@/lib/data';
import { Button, Card, PageHeader } from '@/components/ui';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/csv';

interface Data {
  users: { total: number; last28Days: number; previous28Days: number; verifiedWallets: number };
  money: { heldForCustomers: number; planFees: number; shopSales: number; owedToCreators: number };
  attention: { adviceWaiting: number; openReports: number; heldWithdrawals: number; heldAmount: number; idChecksFailed: number; ordersToPack: number };
  signups: { week: string; value: number }[]; flow: Record<string, number>; activity: { at: string; admin: string; action: string; item: string }[];
}
const flows: [string, string][] = [['deposit', 'Money added'], ['goal_in', 'Moved into goals'], ['withdrawal', 'Withdrawn to bank'], ['purchase', 'Spent in the shop'], ['plan_sale', 'Spent on trip plans']];
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Overview() {
  const admin = useSession((s) => s.admin);
  const { data, error } = useQuery({ queryKey: ['overview'], queryFn: () => adminApi<Data>('/overview') });
  if (!data) return <p className="text-sm text-ink-muted">{error ? errorMessage(error) : 'Loading the overview…'}</p>;
  const { users: u, money: m, attention: a } = data;
  const change = u.previous28Days ? Math.round(((u.last28Days - u.previous28Days) / u.previous28Days) * 100) : null;
  const kpis: { label: string; value: string; note: string; delta?: number }[] = [
    { label: 'Accounts', value: u.total.toLocaleString(), note: `${u.verifiedWallets.toLocaleString()} with a verified wallet` },
    { label: 'New in the last 4 weeks', value: u.last28Days.toLocaleString(), note: 'No earlier period to compare', ...(change !== null && { delta: change }) },
    { label: 'Held for customers', value: naira(m.heldForCustomers), note: 'Wallet balances and savings goals' },
    { label: 'Plan fees earned', value: naira(m.planFees), note: '25% of each paid plan' },
    { label: 'Shop sales', value: naira(m.shopSales), note: 'Including delivery fees' },
    { label: 'Owed to plan sellers', value: naira(m.owedToCreators), note: 'Paid out after Finance approves' },
  ];
  const attention = [
    { count: a.adviceWaiting, label: 'Advice to review', note: 'Waiting for a moderator', href: '/advice' },
    { count: a.openReports, label: 'Reported items', note: 'Tips, comments and advice', href: '/reports' },
    { count: a.heldWithdrawals, label: 'Withdrawals held', note: a.heldWithdrawals ? `${naira(a.heldAmount)} waiting for Finance` : 'Nothing waiting', href: '/transactions' },
    { count: a.ordersToPack, label: 'Orders to pack', note: 'Paid and not yet packed', href: '/orders' },
    { count: a.idChecksFailed, label: 'ID checks failed', note: 'May need a retry', href: '/users' },
  ];
  const maxFlow = Math.max(1, ...flows.map(([k]) => data.flow[k] ?? 0));
  return (
    <>
      <PageHeader title={`${greeting()}, ${admin?.name.split(' ')[0] ?? ''}`} subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
        <Button onClick={() => downloadCsv('overview.csv', kpis.map((k) => ({ metric: k.label, value: k.value, note: k.note })))}>Export CSV</Button>
      </PageHeader>
      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-[18px] bg-white p-4">
            <span className="text-[13px] text-ink-muted">{k.label}</span><b className="tnum text-2xl font-semibold">{k.value}</b>
            {k.delta !== undefined ? <span className={k.delta < 0 ? 'text-xs font-semibold text-danger' : 'text-xs font-semibold text-navy'}>{k.delta < 0 ? '▼' : '▲'} {Math.abs(k.delta)}% on the 4 weeks before</span> : <span className="text-xs text-ink-muted">{k.note}</span>}
          </div>
        ))}
      </section>
      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Needs attention</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {attention.map((x) => (
            <Link key={x.label} href={x.href} className="flex flex-col rounded-2xl border border-line p-3.5 text-ink no-underline hover:border-navy hover:text-ink">
              <b className="tnum text-2xl font-semibold text-navy">{x.count}</b><span className="text-sm font-semibold">{x.label}</span><span className="text-xs text-ink-muted">{x.note}</span>
            </Link>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-base font-semibold">Weekly sign-ups</h2><span className="text-xs text-ink-muted">Weeks starting Monday</span></div>
          <div className="h-60" role="img" aria-label={`Weekly sign-ups for the last eight weeks: ${data.signups.map((s) => `${s.week} ${s.value}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signups} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.line} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.inkMuted }} />
                <YAxis hide domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.15))]} />
                <Tooltip cursor={{ fill: colors.surfaceMuted }} formatter={(v) => [Number(v).toLocaleString(), 'Sign-ups']} />
                <Bar dataKey="value" fill={colors.navy} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                  <LabelList dataKey="value" position="top" formatter={(v) => Number(v).toLocaleString()} style={{ fontSize: 12, fill: colors.ink, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="flex flex-col gap-3.5">
          <h2 className="text-base font-semibold">Wallet money flow · last 4 weeks</h2>
          {flows.map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm"><span>{label}</span><b className="tnum font-semibold">{naira(data.flow[k] ?? 0)}</b></div>
              <div className="h-2.5 rounded-full bg-surface-muted"><div className="h-full rounded-full bg-sky" style={{ width: `${((data.flow[k] ?? 0) / maxFlow) * 100}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><h2 className="text-base font-semibold">Recent admin activity</h2><Link href="/admins" className="text-[13px] font-semibold no-underline">Full audit log</Link></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-muted">{['Time', 'Admin', 'Action', 'Item'].map((h) => <th key={h} scope="col" className="border-b border-line px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{data.activity.map((r) => <tr key={r.at + r.action}>{[when(r.at), r.admin, r.action, r.item].map((c, i) => <td key={i} className="border-b border-line px-3 py-3 whitespace-nowrap">{c}</td>)}</tr>)}
              {!data.activity.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-ink-muted">Nothing recorded yet.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
