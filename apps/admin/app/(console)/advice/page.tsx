'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { adminSample } from '@/lib/data';
import { adminApi, ago, errorMessage } from '@/lib/api';
import { Avatar, Badge, Button, Card, Chips, Field, Notice, PageHeader, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { accessFor, useSession } from '@/lib/session';

type Queue = 'waiting' | 'changes' | 'rereview' | 'decided';
interface Item {
  id: string; countryCode: string; city: string; topic: string; body: string; visited: string | null; status: string; submittedAt: string; reviewNote: string | null; reviewedBy: string | null;
  reports: number; reportReasons: string[]; evidence: string[]; author: { name: string; since: string; passportCountry: string; tips: number; approved: number; rejected: number };
}
interface Data { counts: Record<Queue, number>; items: Item[] }
const countryName = (code: string) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code; } catch { return code; } };
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const STATUS: Record<string, { label: string; tone: 'info' | 'warn' | 'danger' }> = { verified: { label: 'Approved and verified', tone: 'info' }, rejected: { label: 'Rejected', tone: 'danger' }, changes_requested: { label: 'Changes requested', tone: 'warn' } };

export default function AdviceReview() {
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'moderation') === 'Edit';
  const refreshSession = useSession((s) => s.refresh);
  const qc = useQueryClient();
  const [queue, setQueue] = useState<Queue>('waiting');
  const { data, error, isLoading } = useQuery({ queryKey: ['advice', queue], queryFn: () => adminApi<Data>(`/advice?queue=${queue}`) });
  const [country, setCountry] = useState('All countries'); const [topic, setTopic] = useState('All topics'); const [oldestFirst, setOldestFirst] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [checks, setChecks] = useState<boolean[]>([]); const [note, setNote] = useState(''); const [notice, setNotice] = useState('');

  const all = data?.items ?? [];
  const filtered = all.filter((a) => (country === 'All countries' || countryName(a.countryCode) === country) && (topic === 'All topics' || a.topic === topic));
  const list = oldestFirst ? filtered : [...filtered].reverse();
  const item = list.find((a) => a.id === selectedId) ?? list[0];
  const c = data?.counts; const open = queue !== 'decided';
  const allChecked = adminSample.reviewChecklist.every((_, i) => checks[i]);
  const pick = (id: string | null) => { setSelectedId(id); setChecks([]); setNote(''); };

  const decide = useMutation({
    mutationFn: (v: { item: Item; decision: 'approve' | 'changes' | 'reject' }) => adminApi(`/advice/${v.item.id}/decision`, { method: 'POST', body: { decision: v.decision, note: note.trim() || undefined } }),
    onSuccess: (_, v) => { setNotice(`${{ approve: 'Approved and verified', changes: 'Changes requested', reject: 'Rejected' }[v.decision]}: advice from ${v.item.author.name} on ${countryName(v.item.countryCode)}. The author will be notified.`); pick(null); },
    onError: (e) => setNotice(errorMessage(e)),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['advice'] }); refreshSession().catch(() => {}); },
  });
  const send = (decision: 'approve' | 'changes' | 'reject') => { if (!item) return; if (decision !== 'approve' && note.trim().length < 5) return setNotice('Add a note to the author before you request changes or reject.'); decide.mutate({ item, decision }); };

  return (
    <>
      <PageHeader title="Advice review" subtitle={`${c ? c.waiting + c.rereview : '…'} waiting · advice gets the Verified badge only when you approve it`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips label="Queue" value={queue} onChange={(q) => { setQueue(q); pick(null); setNotice(''); }} options={[
          { value: 'waiting', label: `Waiting · ${c?.waiting ?? '…'}` }, { value: 'changes', label: `Changes requested · ${c?.changes ?? '…'}` },
          { value: 'rereview', label: `Re-review after report · ${c?.rereview ?? '…'}` }, { value: 'decided', label: `Decided · ${c?.decided ?? '…'}` }]} />
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 w-auto text-[13px]">{['All countries', ...new Set(all.map((a) => countryName(a.countryCode)))].map((x) => <option key={x}>{x}</option>)}</Select>
          <Select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-9 w-auto text-[13px]">{['All topics', ...new Set(all.map((a) => a.topic))].map((x) => <option key={x}>{x}</option>)}</Select>
          <Select aria-label="Order" value={oldestFirst ? 'o' : 'n'} onChange={(e) => setOldestFirst(e.target.value === 'o')} className="h-9 w-auto text-[13px]"><option value="o">{open ? 'Oldest first' : 'Latest decision first'}</option><option value="n">{open ? 'Newest first' : 'Earliest decision first'}</option></Select>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{errorMessage(error)}</p>}
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <ul aria-label="Submissions" className="flex flex-[1_1_300px] flex-col gap-2.5">
          {list.map((a) => (
            <li key={a.id}>
              <button onClick={() => { pick(a.id); setNotice(''); }} aria-current={a.id === item?.id}
                className={cn('flex w-full cursor-pointer flex-col gap-1 rounded-2xl border-2 bg-white p-3.5 text-left', a.id === item?.id ? 'border-navy' : 'border-transparent hover:border-line')}>
                <span className="flex justify-between gap-2 text-xs"><b className="font-semibold text-heading-blue">{countryName(a.countryCode)} · {a.topic}</b><span className="text-ink-muted">{ago(a.submittedAt)} ago</span></span>
                <span className="line-clamp-2 text-sm">{a.body}</span>
                <span className={cn('text-xs', a.evidence.length ? 'text-ink-muted' : 'font-semibold text-danger')}>{a.author.name} · {a.reports ? `${a.reports} reports` : a.evidence.length ? 'has posted from this place' : 'no evidence of a visit'}</span>
              </button>
            </li>
          ))}
          {!isLoading && list.length === 0 && <li className="rounded-2xl bg-white p-6 text-center text-sm text-ink-muted">Nothing in this queue.</li>}
        </ul>
        {item && (
          <Card className="flex flex-[2_1_460px] flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar initials={initials(item.author.name)} />
              <div className="flex flex-1 flex-col"><b className="text-sm font-semibold">{item.author.name} · member since {new Date(item.author.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</b>
                <span className="text-xs text-ink-muted">{item.author.tips} tips · {item.author.approved} approved advice · {item.author.rejected} rejected · passport: {countryName(item.author.passportCountry)}</span></div>
              {STATUS[item.status] ? <Badge tone={STATUS[item.status]!.tone}>{STATUS[item.status]!.label}</Badge> : <Badge tone="warn">Waiting · {ago(item.submittedAt)}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2"><Badge tone="neutral">{item.city}, {countryName(item.countryCode)}</Badge><Badge tone="neutral">{item.topic}</Badge><Badge tone="neutral">Visited: {item.visited ?? 'not stated'}</Badge></div>
            <blockquote className="rounded-2xl bg-surface-muted p-4 text-[15px] leading-6">{item.body}</blockquote>
            {item.reports > 0 && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">Reported by {item.reports} travellers: {item.reportReasons.join('; ')}</p>}
            {item.reviewNote && <p className="text-sm"><b className="font-semibold">Note sent to the author:</b> {item.reviewNote}</p>}
            {item.reviewedBy && <p className="text-xs text-ink-muted">Decided by {item.reviewedBy}</p>}
            <div>
              <h2 className="mb-1.5 text-sm font-semibold">Evidence of the visit</h2>
              {item.evidence.length ? <ul className="list-disc pl-5 text-sm leading-6">{item.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                : <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm">Nothing on record links this traveller to {item.city}. Judge the advice on its content, or ask for more detail.</p>}
            </div>
            {open && canEdit && (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-sm font-semibold">Review checklist</legend>
                  {adminSample.reviewChecklist.map((label, i) => (
                    <label key={label} className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks((s) => { const n = [...s]; n[i] = e.target.checked; return n; })} className="size-4 accent-navy" />{label}</label>
                  ))}
                </fieldset>
                <Field label='Note to the author (needed for "Request changes" or "Reject")'><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please say which month this applied to." /></Field>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="primary" disabled={!allChecked || decide.isPending} onClick={() => send('approve')}><BadgeCheck className="size-4" />Approve &amp; verify</Button>
                  <Button disabled={decide.isPending} onClick={() => send('changes')}>Request changes</Button>
                  <Button variant="danger" disabled={decide.isPending} onClick={() => send('reject')}>Reject</Button>
                  <span className="text-xs text-ink-muted">{allChecked ? 'The author is notified of every decision' : 'Tick all four checks to approve'}</span>
                </div>
              </>
            )}
            {open && !canEdit && <p className="text-sm text-ink-muted">Your role can view the queue but not decide.</p>}
          </Card>
        )}
      </div>
    </>
  );
}
