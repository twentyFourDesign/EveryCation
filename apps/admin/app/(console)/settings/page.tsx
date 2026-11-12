'use client';
import { useState, type ReactNode } from 'react';
import { adminSample } from '@/lib/data';
import { Badge, Button, Card, Input, LockedMark, Notice, PageHeader, Select, Switch } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="flex flex-col"><span className="text-sm font-semibold">{title}</span>{hint && <span className="text-xs text-ink-muted">{hint}</span>}</span>
      <span className="flex flex-none items-center gap-2">{children}</span>
    </div>
  );
}
const Group = ({ title, children }: { title: string; children: ReactNode }) => <Card className="flex flex-col gap-1"><h2 className="mb-2 text-base font-semibold">{title}</h2>{children}</Card>;

export default function Settings() {
  const canEdit = accessFor(useSession((s) => s.admin)!.role, 'settings') === 'Edit';
  const [s, setS] = useState(adminSample.platformSettings);
  const [saved, setSaved] = useState(adminSample.platformSettings);
  const [notice, setNotice] = useState('');
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const lockedChanged = s.salesAfterTripEnds !== saved.salesAfterTripEnds;
  const small = 'h-10 w-auto rounded-[10px] text-sm';
  return (
    <>
      <PageHeader title="Platform settings" subtitle="Changes to locked rules need a second Super admin to approve">
        <Button variant="primary" disabled={!dirty || !canEdit} onClick={() => { setSaved(lockedChanged ? { ...s, salesAfterTripEnds: saved.salesAfterTripEnds } : s); if (lockedChanged) set('salesAfterTripEnds', saved.salesAfterTripEnds); setNotice(lockedChanged ? 'Saved. The change to a locked rule was sent to a second Super admin and is not live yet.' : 'Settings saved. Recorded in the audit log.'); }}>Save changes</Button>
      </PageHeader>
      <Notice>{notice}</Notice>
      <fieldset disabled={!canEdit} className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-4">
        <legend className="sr-only">Platform settings</legend>
        <Group title="Trip plan sales">
          <Row title="Platform fee" hint="Taken from every sale. Seller keeps the rest."><span className="tnum rounded-[10px] bg-surface-muted px-3.5 py-2 text-[15px] font-bold">{s.feePercent}%</span><LockedMark /></Row>
          <Row title="Open sales only after the seller's trip ends" hint="Free sharing is always allowed"><Switch label="Open sales only after trip ends" checked={s.salesAfterTripEnds} onCheckedChange={(v) => set('salesAfterTripEnds', v)} /><LockedMark /></Row>
          <Row title="Sellers need a verified ID to be paid" hint="Anyone can list a plan"><Switch label="Verified ID needed for payouts" checked={s.sellersNeedId} onCheckedChange={(v) => set('sellersNeedId', v)} /></Row>
          <Row title="Payout day"><Select aria-label="Payout day" className={small} value={s.payoutDay} onChange={(e) => set('payoutDay', e.target.value)}><option>Every Friday</option><option>Every Monday</option></Select></Row>
        </Group>
        <Group title="Travel advice">
          <Row title="Verified only after admin approval" hint="Every new piece of advice goes to the review queue"><LockedMark /></Row>
          <Row title="Hide unreviewed advice from the default view" hint={'Travellers can still switch "Verified only" off'}><Switch label="Hide unreviewed advice" checked={s.hideUnreviewed} onCheckedChange={(v) => set('hideUnreviewed', v)} /></Row>
          <Row title="Send verified advice back to review after" hint="reports from different users"><Input aria-label="Number of reports" type="number" min={1} max={20} className="h-10 w-16 rounded-[10px] px-0 text-center text-[15px] font-semibold" value={s.reportsToRereview} onChange={(e) => set('reportsToRereview', Number(e.target.value))} /></Row>
        </Group>
        <Group title="Wallet">
          <Row title="Daily withdrawal limit per user"><Input aria-label="Daily withdrawal limit" className="h-10 w-32 rounded-[10px] px-2.5 font-semibold" value={s.dailyLimit} onChange={(e) => set('dailyLimit', e.target.value)} /></Row>
          <Row title="Hold withdrawals to a newly added bank" hint="For the first 24 hours"><Switch label="Hold withdrawals to new banks" checked={s.holdNewBank} onCheckedChange={(v) => set('holdNewBank', v)} /></Row>
          <Row title="Payments partner" hint="Holds customer money, runs transfers and BVN/NIN checks"><span className="text-[13px] font-semibold">[partner name]</span></Row>
        </Group>
        <Group title="Shop & integrations">
          <Row title="Shop currency"><span className="text-sm">Naira (₦)</span></Row>
          <Row title={'"Travelling soon" priority'} hint="Ship first if the customer flies within"><Select aria-label="Travelling soon window" className={small} value={s.soonDays} onChange={(e) => set('soonDays', e.target.value)}><option>7 days</option><option>14 days</option></Select></Row>
          <Row title="Google Calendar sync" hint={'One-way, into each user\'s "EveryCation trips" calendar'}><Badge>Connected</Badge></Row>
          <Row title="Email codes & push notifications"><Badge>Connected</Badge></Row>
        </Group>
      </fieldset>
    </>
  );
}
