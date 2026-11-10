'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { broadcastSchema, type BroadcastInput } from '@everycation/shared';
import { adminSample } from '@/lib/data';
import { Button, Card, Field, Input, Notice, PageHeader, Select, Textarea } from '@/components/ui';

export default function Broadcasts() {
  const [notice, setNotice] = useState('');
  const [sent, setSent] = useState(adminSample.sentBroadcasts.map((b) => ({ ...b, delivered: b.delivered.toLocaleString(), opened: `${b.opened}%` })));
  const { register, handleSubmit, control, formState: { errors } } = useForm<BroadcastInput>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { audience: adminSample.audiences[0], title: 'Travelling in December?', message: 'Order your travel essentials by 4 December so they arrive before you fly.', opens: adminSample.broadcastTargets[0], date: 'Thu 12 Nov 2026', time: '18:00 WAT' },
  });
  const [title, message] = useWatch({ control, name: ['title', 'message'] });
  const schedule = handleSubmit((v) => {
    setSent((s) => [{ sent: `Scheduled · ${v.date.replace(/ \d{4}$/, '')}`, title: v.title, audience: v.audience.split(' · ')[0]!, delivered: '—', opened: '—' }, ...s]);
    setNotice(`Scheduled for ${v.date} at ${v.time}.`);
  });
  return (
    <>
      <PageHeader title="Notifications" subtitle="Send a push notification or in-app message to a group of travellers" />
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <form onSubmit={schedule} noValidate className="flex flex-[3_1_460px] flex-col gap-4.5 rounded-card bg-white p-5.5">
          <h2 className="text-[17px] font-semibold">New broadcast</h2>
          <Field label="Audience"><Select {...register('audience')}>{adminSample.audiences.map((a) => <option key={a}>{a}</option>)}</Select></Field>
          <Field label="Title" error={errors.title?.message}><Input aria-invalid={!!errors.title} {...register('title')} /></Field>
          <Field label="Message" error={errors.message?.message} hint={`${message?.length ?? 0} of 140 characters`}><Textarea rows={3} aria-invalid={!!errors.message} {...register('message')} /></Field>
          <Field label="Opens"><Select {...register('opens')}>{adminSample.broadcastTargets.map((a) => <option key={a}>{a}</option>)}</Select></Field>
          <div className="flex flex-wrap gap-3">
            <div className="flex-[1_1_160px]"><Field label="Send on" error={errors.date?.message}><Input {...register('date')} /></Field></div>
            <div className="flex-[1_1_120px]"><Field label="At" error={errors.time?.message}><Input {...register('time')} /></Field></div>
          </div>
          <div className="flex flex-wrap gap-2.5"><Button type="submit" variant="primary" size="lg">Schedule</Button><Button size="lg" onClick={() => setNotice('Test sent to your phone.')}>Send test to me</Button></div>
        </form>
        <aside aria-label="Phone preview" className="flex flex-[1_1_280px] flex-col gap-3 rounded-card bg-navy p-5.5 text-white">
          <span className="text-xs font-semibold tracking-[0.08em] text-gold">PREVIEW</span>
          <div className="flex gap-3 rounded-[18px] bg-white p-3.5 text-ink">
            <Image src="/brand/everycation-mark.svg" alt="" width={36} height={36} className="size-9" />
            <span className="flex min-w-0 flex-col gap-0.5"><b className="text-sm font-semibold break-words">{title || 'Title'}</b><span className="text-[13px] leading-[19px] break-words">{message || 'Message'}</span></span>
          </div>
          <span className="text-xs leading-[18px] text-navy-soft">Users who turned off marketing notifications won&apos;t get this.</span>
        </aside>
      </div>
      <Card className="overflow-x-auto p-2 pb-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Sent broadcasts</caption>
          <thead><tr className="text-xs text-ink-muted">{['Sent', 'Title', 'Audience', 'Delivered', 'Opened'].map((h, i) => <th key={h} scope="col" className={`border-b border-line px-3 py-2.5 font-semibold ${i > 2 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>{sent.map((b) => <tr key={b.sent + b.title} className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-3 [&>td]:whitespace-nowrap"><td>{b.sent}</td><td>{b.title}</td><td>{b.audience}</td><td className="tnum text-right">{b.delivered}</td><td className="tnum text-right">{b.opened}</td></tr>)}</tbody>
        </table>
      </Card>
    </>
  );
}
