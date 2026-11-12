'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';
import { adminApi, errorMessage, when } from '@/lib/api';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Textarea } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

interface Data {
  audiences: { id: string; label: string; people: number }[]; targets: { href: string; label: string }[];
  sent: { id: string; status: 'sent' | 'scheduled' | 'cancelled'; sentAt: string | null; sendAt: string | null; sentBy: string; title: string; message: string; audience: string; opens: string; recipients: number; opened: number }[];
}
const blank = { title: '', message: '', audience: 'everyone', href: '', when: 'now', at: '' };
/** The value a date-and-time field needs for "an hour from now", in the computer's own time zone. */
const inAnHour = () => { const d = new Date(Date.now() + 3_600_000 - new Date().getTimezoneOffset() * 60_000); return d.toISOString().slice(0, 16); };

export default function Broadcasts() {
  const qc = useQueryClient();
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'broadcasts') === 'Edit';
  const [draft, setDraft] = useState(blank); const [notice, setNotice] = useState(''); const [confirming, setConfirming] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['broadcasts'], queryFn: () => adminApi<Data>('/broadcasts') });
  const set = (k: keyof typeof blank, v: string) => { setDraft((d) => ({ ...d, [k]: v })); setConfirming(false); };
  const audience = data?.audiences.find((a) => a.id === draft.audience);
  const problems = { title: draft.title.trim().length < 3 ? 'Write a title of at least 3 characters' : undefined, message: draft.message.trim().length < 10 ? 'Write a message of at least 10 characters' : undefined };
  const later = draft.when === 'later'; const at = later && draft.at ? new Date(draft.at) : null;
  const atProblem = later && (!at || Number.isNaN(at.getTime())) ? 'Choose a date and time' : undefined;
  const ready = !problems.title && !problems.message && !atProblem && (later || !!audience?.people);
  const send = useMutation({
    mutationFn: () => adminApi<{ recipients: number; audience: string; sendAt: string | null }>('/broadcasts', { method: 'POST', body: { title: draft.title.trim(), message: draft.message.trim(), audience: draft.audience, href: draft.href, ...(at && { sendAt: at.toISOString() }) } }),
    onSuccess: (r) => { setNotice(r.sendAt ? `Scheduled for ${when(r.sendAt)}. It goes to whoever is in the audience at that moment. You can cancel it below until then.` : `Sent to ${r.recipients.toLocaleString()} traveller${r.recipients === 1 ? '' : 's'}. It is in their in-app notifications now.`); setDraft(blank); qc.invalidateQueries({ queryKey: ['broadcasts'] }); },
    onError: (e) => setNotice(errorMessage(e)), onSettled: () => setConfirming(false),
  });
  const cancel = useMutation({ mutationFn: (id: string) => adminApi(`/broadcasts/${id}/cancel`, { method: 'POST' }), onSuccess: () => { setNotice('Cancelled. It will not be sent.'); qc.invalidateQueries({ queryKey: ['broadcasts'] }); }, onError: (e) => setNotice(errorMessage(e)) });
  return (
    <>
      <PageHeader title="Notifications" subtitle="Send a message to a group of travellers. It appears in their in-app notifications, now or at a time you choose." />
      <Notice>{notice || (error ? errorMessage(error) : '')}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (!ready) return; setNotice(''); setConfirming(true); }} className="flex flex-[3_1_460px] flex-col gap-4.5 rounded-card bg-white p-5.5">
          <h2 className="text-[17px] font-semibold">New notification</h2>
          <fieldset disabled={!canEdit || send.isPending} className="flex flex-col gap-4.5">
            <Field label="Audience" hint={audience ? (audience.people ? `${audience.people.toLocaleString()} traveller${audience.people === 1 ? '' : 's'} right now. Suspended accounts are left out.` : 'Nobody matches this audience right now.') : undefined}>
              <Select value={draft.audience} onChange={(e) => set('audience', e.target.value)}>{(data?.audiences ?? [{ id: 'everyone', label: 'Everyone', people: 0 }]).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Field>
            <Field label="Title" error={draft.title ? problems.title : undefined}><Input value={draft.title} maxLength={60} onChange={(e) => set('title', e.target.value)} placeholder="Travelling in December?" /></Field>
            <Field label="Message" error={draft.message ? problems.message : undefined} hint={`${draft.message.length} of 140 characters`}><Textarea rows={3} maxLength={140} value={draft.message} onChange={(e) => set('message', e.target.value)} placeholder="Order your travel essentials by 4 December so they arrive before you fly." /></Field>
            <Field label="When tapped, open"><Select value={draft.href} onChange={(e) => set('href', e.target.value)}>{(data?.targets ?? [{ href: '', label: 'Nothing (message only)' }]).map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}</Select></Field>
            <fieldset className="flex flex-col gap-2 text-sm"><legend className="mb-1 text-[13px] font-semibold">When</legend>
              <label className="flex items-center gap-2.5"><input type="radio" name="when" checked={!later} onChange={() => set('when', 'now')} className="size-4 accent-navy" />Send now</label>
              <label className="flex items-center gap-2.5"><input type="radio" name="when" checked={later} onChange={() => setDraft((d) => ({ ...d, when: 'later', at: d.at || inAnHour() }))} className="size-4 accent-navy" />Schedule for later</label>
              {later && <Field label="Date and time" error={atProblem} hint="In your computer's time zone."><Input type="datetime-local" value={draft.at} onChange={(e) => set('at', e.target.value)} className="max-w-64" /></Field>}
            </fieldset>
          </fieldset>
          {!canEdit ? <p className="text-sm text-ink-muted">Your role can see what was sent but not send.</p> : confirming
            ? <div className="flex flex-wrap items-center gap-2.5"><span className="text-sm">{later ? `Schedule for ${when(at!.toISOString())}?` : `Send to ${audience!.people.toLocaleString()} traveller${audience!.people === 1 ? '' : 's'}? It cannot be unsent.`}</span><Button variant="primary" disabled={send.isPending} onClick={() => send.mutate()}>{send.isPending ? 'Working…' : later ? 'Yes, schedule it' : 'Yes, send now'}</Button><Button onClick={() => setConfirming(false)}>Cancel</Button></div>
            : <div><Button type="submit" variant="primary" size="lg" disabled={!ready}>{later ? 'Schedule' : 'Send now'}</Button></div>}
        </form>
        <aside aria-label="Preview" className="flex flex-[1_1_280px] flex-col gap-3 rounded-card bg-navy p-5.5 text-white">
          <span className="text-xs font-semibold tracking-[0.08em] text-gold">PREVIEW</span>
          <div className="flex gap-3 rounded-[18px] bg-white p-3.5 text-ink">
            <Image src="/brand/everycation-mark.svg" alt="" width={36} height={36} className="size-9" />
            <span className="flex min-w-0 flex-col gap-0.5"><b className="text-sm font-semibold break-words">{draft.title || 'Title'}</b><span className="text-[13px] leading-[19px] break-words">{draft.message || 'Message'}</span></span>
          </div>
          <span className="text-xs leading-[18px] text-navy-soft">Shown in the app&apos;s notifications. Push to the phone&apos;s lock screen and email are not connected yet.</span>
        </aside>
      </div>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Sent notifications</caption>
          <thead><tr className="text-xs text-ink-muted">{['When', 'Title', 'Audience', 'Opens', 'By', 'Delivered', 'Read', ''].map((h, i) => <th key={h} scope="col" className={`border-b border-line px-3 py-2.5 font-semibold ${i === 5 || i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.sent.map((b) => <tr key={b.id} className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-3 [&>td]:align-top"><td className="whitespace-nowrap">{b.status === 'sent' ? when(b.sentAt!) : <>{when(b.sendAt!)}<span className="block"><Badge tone={b.status === 'cancelled' ? 'neutral' : 'warn'}>{b.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}</Badge></span></>}</td><td><b className="font-semibold">{b.title}</b><span className="block max-w-80 text-xs text-ink-muted">{b.message}</span></td><td>{b.audience}</td><td className="whitespace-nowrap">{b.opens}</td><td className="whitespace-nowrap">{b.sentBy}</td>
              <td className="tnum text-right">{b.status === 'sent' ? b.recipients.toLocaleString() : '—'}</td><td className="tnum text-right whitespace-nowrap">{b.status === 'sent' ? `${b.opened.toLocaleString()}${b.recipients ? ` · ${Math.round((b.opened / b.recipients) * 100)}%` : ''}` : '—'}</td>
              <td>{b.status === 'scheduled' && canEdit && <Button size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(b.id)}>Cancel</Button>}</td></tr>)}
            {!data?.sent.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-ink-muted">{isLoading ? 'Loading…' : 'Nothing sent yet.'}</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
