'use client';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { adminSample, api } from '@/lib/data';
import type { AdviceQueue } from '@everycation/shared';
import { Avatar, Badge, Button, Card, Chips, Field, Notice, PageHeader, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';

type Decision = 'approved' | 'changes' | 'rejected';
const decisionText: Record<Decision, string> = { approved: 'Approved and verified', changes: 'Changes requested', rejected: 'Rejected' };

export default function AdviceReview() {
  const { data = [] } = useQuery({ queryKey: ['admin', 'advice'], queryFn: api.admin.adviceQueue });
  const [queue, setQueue] = useState<AdviceQueue>('waiting');
  const [country, setCountry] = useState('All countries');
  const [topic, setTopic] = useState('All topics');
  const [oldestFirst, setOldestFirst] = useState(true);
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');

  const list = useMemo(() => {
    const rows = data.filter((a) => (queue === 'decided' ? decided[a.id] : a.queue === queue && !decided[a.id]))
      .filter((a) => country === 'All countries' || a.country === country)
      .filter((a) => topic === 'All topics' || a.topic === topic);
    return oldestFirst ? rows : [...rows].reverse();
  }, [data, queue, country, topic, oldestFirst, decided]);
  const item = list.find((a) => a.id === selectedId) ?? list[0];
  const doneCount = Object.keys(decided).length;
  const count = (q: AdviceQueue) => q === 'decided' ? doneCount : adminSample.adviceQueueCounts[q] - data.filter((a) => a.queue === q && decided[a.id]).length;
  const allChecked = adminSample.reviewChecklist.every((_, i) => checks[i]);

  function decide(d: Decision) {
    if (!item) return;
    if (d !== 'approved' && note.trim().length < 5) { setNotice('Add a note to the author before you request changes or reject.'); return; }
    setDecided((s) => ({ ...s, [item.id]: d }));
    setNotice(`${decisionText[d]}: advice ${item.id}. ${item.author.name} has been notified.`);
    setChecks([]); setNote(''); setSelectedId(null);
  }

  return (
    <>
      <PageHeader title="Advice review" subtitle={`${count('waiting')} waiting · advice gets the Verified badge only when you approve it`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips label="Queue" value={queue} onChange={(q) => { setQueue(q); setSelectedId(null); }} options={[
          { value: 'waiting', label: `Waiting · ${count('waiting')}` }, { value: 'changes', label: `Changes requested · ${count('changes')}` },
          { value: 'rereview', label: `Re-review after report · ${count('rereview')}` }, { value: 'decided', label: doneCount ? `Decided · ${doneCount}` : 'Decided' }]} />
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 w-auto text-[13px]">{['All countries', ...new Set(data.map((a) => a.country))].map((c) => <option key={c}>{c}</option>)}</Select>
          <Select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-9 w-auto text-[13px]">{['All topics', ...new Set(data.map((a) => a.topic))].map((c) => <option key={c}>{c}</option>)}</Select>
          <Select aria-label="Order" value={oldestFirst ? 'o' : 'n'} onChange={(e) => setOldestFirst(e.target.value === 'o')} className="h-9 w-auto text-[13px]"><option value="o">Oldest first</option><option value="n">Newest first</option></Select>
        </div>
      </div>
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <ul aria-label="Submissions" className="flex flex-[1_1_300px] flex-col gap-2.5">
          {list.map((a) => (
            <li key={a.id}>
              <button onClick={() => { setSelectedId(a.id); setChecks([]); setNotice(''); }} aria-current={a.id === item?.id}
                className={cn('flex w-full cursor-pointer flex-col gap-1 rounded-2xl border-2 bg-white p-3.5 text-left', a.id === item?.id ? 'border-navy' : 'border-transparent hover:border-line')}>
                <span className="flex justify-between gap-2 text-xs"><b className="font-semibold text-heading-blue">{a.country} · {a.topic}</b><span className="text-ink-muted">{a.waiting} ago</span></span>
                <span className="line-clamp-2 text-sm">{a.body}</span>
                <span className={cn('text-xs', a.evidence.length ? 'text-ink-muted' : 'font-semibold text-danger')}>{a.evidence.length ? `${a.author.name} · ${a.evidenceLabel}` : a.evidenceLabel}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="rounded-2xl bg-white p-6 text-center text-sm text-ink-muted">Nothing in this queue.</li>}
        </ul>
        {item && (
          <Card className="flex flex-[2_1_460px] flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar initials={item.author.initials} />
              <div className="flex flex-1 flex-col"><b className="text-sm font-semibold">{item.author.name} · member since {item.author.since}</b><span className="text-xs text-ink-muted">{item.author.record}</span></div>
              {decided[item.id] ? <Badge tone={decided[item.id] === 'approved' ? 'info' : 'danger'}>{decisionText[decided[item.id]!]}</Badge> : <Badge tone="warn">Waiting · {item.waiting}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 text-xs"><Badge tone="neutral">{item.place}</Badge><Badge tone="neutral">{item.topic}</Badge><Badge tone="neutral">Applies to: {item.appliesTo}</Badge></div>
            <blockquote className="rounded-2xl bg-surface-muted p-4 text-[15px] leading-6">{item.body}</blockquote>
            <div>
              <h2 className="mb-1.5 text-sm font-semibold">Evidence of the visit</h2>
              {item.evidence.length ? <ul className="list-disc pl-5 text-sm leading-6">{item.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                : <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">No trip, check-in or photo evidence. Ask for it before approving.</p>}
            </div>
            {!decided[item.id] && (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-sm font-semibold">Review checklist</legend>
                  {adminSample.reviewChecklist.map((c, i) => (
                    <label key={c} className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks((s) => { const n = [...s]; n[i] = e.target.checked; return n; })} className="size-4 accent-navy" />{c}</label>
                  ))}
                </fieldset>
                <Field label='Note to the author (sent with "Request changes" or "Reject")'><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please say which month this applied to." /></Field>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="primary" disabled={!allChecked} onClick={() => decide('approved')}><BadgeCheck className="size-4" />Approve &amp; verify</Button>
                  <Button onClick={() => decide('changes')}>Request changes</Button>
                  <Button variant="danger" onClick={() => decide('rejected')}>Reject</Button>
                  <span className="text-xs text-ink-muted">{allChecked ? 'The author is notified of every decision' : 'Tick all four checks to approve'}</span>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
