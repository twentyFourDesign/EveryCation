'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, ago, errorMessage, naira, when } from '@/lib/api';
import { Badge, Button, Card, Chips, Notice, PageHeader, StatCard } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';
import { accessFor, useSession } from '@/lib/session';

interface Summary { totalHeld: number; available: number; inGoals: number; lockedInGoals: number; inTransit: number; heldCount: number; heldAmount: number }
interface Held { id: string; reference: string; user: string; amount: number; to: string; bankIsNew: boolean; reason: string | null; createdAt: string }
interface Entry { reference: string; kind: string; description: string; user: string; at: string; amount: number; customerChange: number }
const kinds = ['All', 'Deposits', 'Withdrawals', 'Goals'] as const;
const inKind: Record<(typeof kinds)[number], (e: Entry) => boolean> = { All: () => true, Deposits: (e) => e.kind === 'deposit', Withdrawals: (e) => e.kind.startsWith('withdrawal'), Goals: (e) => e.kind.startsWith('goal') };
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm whitespace-nowrap';

export default function Transactions() {
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'wallet') === 'Edit';
  const refreshSession = useSession((s) => s.refresh);
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ['wallet', 'summary'], queryFn: () => adminApi<Summary>('/wallet/summary') });
  const held = useQuery({ queryKey: ['wallet', 'held'], queryFn: () => adminApi<Held[]>('/wallet/withdrawals?status=held') });
  const ledger = useQuery({ queryKey: ['wallet', 'ledger'], queryFn: () => adminApi<Entry[]>('/wallet/ledger?limit=100') });
  const [kind, setKind] = useState<(typeof kinds)[number]>('All');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (v: { w: Held; decision: 'release' | 'reject' }) => adminApi(`/wallet/withdrawals/${v.w.id}/${v.decision}`, { method: 'POST' }),
    onSuccess: (_, v) => { setNotice(v.decision === 'release' ? `Released ${naira(v.w.amount)} to ${v.w.to}. It is now being sent.` : `Rejected ${v.w.reference}. ${naira(v.w.amount)} is back in ${v.w.user}'s wallet.`); },
    onError: (e) => setNotice(errorMessage(e)),
    onSettled: () => { setConfirming(null); qc.invalidateQueries({ queryKey: ['wallet'] }); refreshSession().catch(() => {}); },
  });
  const s = summary.data; const rows = (ledger.data ?? []).filter(inKind[kind]);
  const failed = summary.error ?? held.error ?? ledger.error;
  return (
    <>
      <PageHeader title="Wallet & withdrawals" subtitle="Live from the ledger. Customer money is held with the bank partner.">
        <Button disabled={!rows.length} onClick={() => downloadCsv('ledger.csv', rows.map((r) => ({ time: r.at, reference: r.reference, user: r.user, type: r.description, amount_naira: r.amount / 100, customer_change_naira: r.customerChange / 100 })))}>Download ledger</Button>
      </PageHeader>
      {failed && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{errorMessage(failed)}</p>}
      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Total held for customers" value={s ? naira(s.totalHeld) : '…'} />
        <StatCard label="Available balances" value={s ? naira(s.available) : '…'} />
        <StatCard label="In savings goals" value={s ? naira(s.inGoals) : '…'} note={s ? `${naira(s.lockedInGoals)} locked` : undefined} />
        <StatCard label="On the way to banks" value={s ? naira(s.inTransit) : '…'} note="Includes withdrawals on hold" />
        <StatCard label="Withdrawals on hold" value={s ? `${s.heldCount} · ${naira(s.heldAmount)}` : '…'} alert={!!s?.heldCount} />
      </section>
      <Notice>{notice}</Notice>
      <Card className="flex flex-col gap-2">
        <div><h2 className="text-base font-semibold">Withdrawals on hold</h2><p className="text-xs text-ink-muted">Held automatically: over the daily limit, or to a bank account added in the last 24 hours. The money has already left the customer&apos;s balance and waits here.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full"><caption className="sr-only">Withdrawals on hold</caption>
            <thead><tr>{['User', 'Amount', 'To', 'Why held', 'Waiting', 'Action'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {held.data?.map((w) => (
                <tr key={w.id}>
                  <td className={td}><b className="font-semibold">{w.user}</b><span className="block text-xs text-ink-muted">{w.reference}</span></td>
                  <td className={`${td} tnum`}>{naira(w.amount)}</td>
                  <td className={td}>{w.to} {w.bankIsNew && <Badge tone="warn">new</Badge>}</td><td className={td}>{w.reason}</td><td className={td}>{ago(w.createdAt)}</td>
                  <td className={td}>{!canEdit ? 'View only' : confirming === w.id ? (
                    <span className="flex items-center gap-2"><span className="text-xs">Return {naira(w.amount)} to the customer?</span>
                      <Button size="sm" variant="danger" disabled={decide.isPending} onClick={() => decide.mutate({ w, decision: 'reject' })}>Yes, reject</Button><Button size="sm" onClick={() => setConfirming(null)}>Cancel</Button></span>
                  ) : (
                    <span className="flex gap-2"><Button size="sm" variant="navy" disabled={decide.isPending} onClick={() => decide.mutate({ w, decision: 'release' })}>Release</Button><Button size="sm" onClick={() => setConfirming(w.id)}>Reject</Button></span>)}</td>
                </tr>
              ))}
              {held.data?.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-muted">Nothing on hold.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Ledger</h2><Chips label="Ledger type" value={kind} onChange={setKind} options={kinds} /></div>
        <div className="overflow-x-auto">
          <table className="w-full"><caption className="sr-only">Ledger</caption>
            <thead><tr>{['Time', 'Reference', 'User', 'Type'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}<th scope="col" className={`${th} text-right`}>Amount</th><th scope="col" className={`${th} text-right`}>Customer balance</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reference}><td className={td}>{when(r.at)}</td><td className={td}><b className="font-semibold">{r.reference.length > 24 ? `${r.reference.slice(0, 22)}…` : r.reference}</b></td><td className={td}>{r.user}</td><td className={td}>{r.description}</td>
                  <td className={`${td} tnum text-right`}>{naira(r.amount)}</td><td className={`${td} tnum text-right`}>{r.customerChange === 0 ? 'No change' : naira(r.customerChange, { sign: true })}</td></tr>
              ))}
              {ledger.data && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-muted">No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
