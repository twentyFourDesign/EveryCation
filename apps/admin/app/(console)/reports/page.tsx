'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, ago, errorMessage } from '@/lib/api';
import { Badge, Button, Card, Chips, Notice, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { accessFor, useSession } from '@/lib/session';

type Target = 'tip' | 'comment' | 'advice';
interface Report { targetType: Target; targetId: string; reports: number; priority: 'High' | 'Normal'; reasons: string[]; openedAt: string; item: string; body: string; removed: boolean; author: { id: string; name: string; suspended: boolean } | null }
const types = ['All types', 'Tips', 'Comments', 'Advice'] as const;
const typeOf: Record<(typeof types)[number], Target | null> = { 'All types': null, Tips: 'tip', Comments: 'comment', Advice: 'advice' };
const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-3 text-sm';

export default function Reports() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'moderation') === 'Edit';
  const refreshSession = useSession((s) => s.refresh);
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [type, setType] = useState<(typeof types)[number]>('All types');
  const [selected, setSelected] = useState<string | null>(null);
  const [decision, setDecision] = useState<'remove' | 'keep'>('remove');
  const [suspend, setSuspend] = useState(false);
  const [notice, setNotice] = useState('');
  const { data = [], isLoading, error } = useQuery({ queryKey: ['reports', status], queryFn: () => adminApi<Report[]>(`/reports?status=${status}`) });
  const rows = data.filter((r) => !typeOf[type] || r.targetType === typeOf[type]);
  const current = rows.find((r) => r.targetId === selected) ?? rows[0];
  const apply = useMutation({
    mutationFn: (r: Report) => adminApi<{ reportsClosed: number; suspended: boolean }>('/reports/decision', { method: 'POST', body: { targetType: r.targetType, targetId: r.targetId, decision, suspendAuthor: suspend } }),
    onSuccess: (res, r) => { setNotice(`${decision === 'remove' ? 'Removed' : 'Kept'}: ${r.item}. ${res.reportsClosed} report${res.reportsClosed === 1 ? '' : 's'} closed${res.suspended ? ', and the author is suspended' : ''}.${decision === 'remove' ? ' The author has been told.' : ''}`); setSelected(null); setSuspend(false); qc.invalidateQueries({ queryKey: ['reports'] }); refreshSession().catch(() => {}); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Reports" subtitle="What travellers flagged on tips, comments and advice. Three reports on an item mark it high priority." />
      <div className="flex flex-wrap justify-between gap-3">
        <Chips label="Type" value={type} onChange={setType} options={types} />
        <Chips label="Status" value={status} onChange={(s) => { setStatus(s); setSelected(null); }} options={[{ value: 'open', label: status === 'open' ? `Open · ${data.length}` : 'Open' }, { value: 'closed', label: 'Closed' }]} />
      </div>
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="flex-[3_1_520px] overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="sr-only">Reports</caption>
            <thead><tr>{['Priority', 'Item', 'Reasons', 'Reports', 'Opened'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.targetId} onClick={() => { setSelected(r.targetId); setNotice(''); }} className={cn('cursor-pointer hover:bg-surface-muted', r.targetId === current?.targetId && 'bg-tint hover:bg-tint')}>
                  <td className={td}><Badge tone={r.priority === 'High' ? 'danger' : 'neutral'}>{r.priority}</Badge></td>
                  <td className={td}><b className="font-semibold">{r.item}</b></td><td className={td}>{r.reasons.join(', ')}</td><td className={`${td} tnum`}>{r.reports}</td><td className={`${td} whitespace-nowrap`}>{ago(r.openedAt)} ago</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-ink-muted">{isLoading ? 'Loading reports…' : status === 'open' ? 'No open reports. Nothing needs a decision.' : 'No closed reports yet.'}</td></tr>}
            </tbody>
          </table>
        </Card>
        {current && (
          <Card className="flex flex-[2_1_360px] flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold capitalize">{current.targetType} report</h2><Badge tone={current.priority === 'High' ? 'danger' : 'neutral'}>{current.priority} · {current.reports} report{current.reports === 1 ? '' : 's'}</Badge></div>
            <div className="text-sm"><b className="font-semibold">{current.item}</b><span className="block text-ink-muted">by {current.author?.name ?? 'unknown'}{current.author?.suspended ? ' · suspended' : ''}</span></div>
            <blockquote className="rounded-xl bg-surface-muted p-3 text-sm whitespace-pre-wrap">{current.body || 'No text.'}</blockquote>
            <div><h3 className="mb-1 text-[13px] font-semibold">What reporters said</h3><ul className="list-disc pl-5 text-sm">{current.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
            {status === 'closed' ? <Badge tone={current.removed ? 'danger' : 'info'}>{current.removed ? 'Removed' : 'Kept'}</Badge> : !canEdit ? <p className="text-sm text-ink-muted">Your role can view reports but not decide them.</p> : (
              <>
                <fieldset className="flex flex-col gap-2 text-sm"><legend className="mb-1 text-[13px] font-semibold">Decision</legend>
                  <label className="flex items-center gap-2.5"><input type="radio" name="decision" checked={decision === 'remove'} onChange={() => setDecision('remove')} className="size-4 accent-navy" />Remove it and tell the author</label>
                  <label className="flex items-center gap-2.5"><input type="radio" name="decision" checked={decision === 'keep'} onChange={() => setDecision('keep')} className="size-4 accent-navy" />Keep it{current.targetType === 'advice' && ' (verified advice stays verified)'}</label>
                </fieldset>
                <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={suspend} onChange={(e) => setSuspend(e.target.checked)} className="size-4 accent-navy" />Suspend the author and freeze their wallet</label>
                <div><Button variant="primary" disabled={apply.isPending} onClick={() => apply.mutate(current)}>{apply.isPending ? 'Applying…' : 'Apply decision'}</Button></div>
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
