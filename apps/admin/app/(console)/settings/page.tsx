'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { adminApi, errorMessage } from '@/lib/api';
import { Badge, Button, Card, Input, LockedMark, Notice, PageHeader, Switch } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

interface Settings { dailyWithdrawalLimitKobo: number; holdNewBank: boolean; reportsToRereview: number; deliveryStandardKobo: number; deliveryExpressKobo: number; minPlanPriceKobo: number }
interface Data { settings: Settings; locked: { planFeePercent: number; newBankHoldHours: number }; services: { email: boolean; payments: boolean; identity: boolean; cloudStorage: boolean; push: boolean }; changed?: string[] }
type Money = 'dailyWithdrawalLimitKobo' | 'deliveryStandardKobo' | 'deliveryExpressKobo' | 'minPlanPriceKobo';
/** What is typed in the form. Money is in naira, as text, until it is saved. */
type Draft = Record<Money | 'reportsToRereview', string> & { holdNewBank: boolean };
const toDraft = (s: Settings): Draft => ({ dailyWithdrawalLimitKobo: String(s.dailyWithdrawalLimitKobo / 100), deliveryStandardKobo: String(s.deliveryStandardKobo / 100), deliveryExpressKobo: String(s.deliveryExpressKobo / 100), minPlanPriceKobo: String(s.minPlanPriceKobo / 100), reportsToRereview: String(s.reportsToRereview), holdNewBank: s.holdNewBank });
const naira = (text: string) => { const n = Number(text.replace(/[₦,\s]/g, '')); return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; };

function Row({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="flex flex-col"><span className="text-sm font-semibold">{title}</span>{hint && <span className="text-xs text-ink-muted">{hint}</span>}{error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}</span>
      <span className="flex flex-none items-center gap-2">{children}</span>
    </div>
  );
}
const Group = ({ title, children }: { title: string; children: ReactNode }) => <Card className="flex flex-col gap-1"><h2 className="mb-2 text-base font-semibold">{title}</h2>{children}</Card>;
const Fixed = ({ children }: { children: ReactNode }) => <><span className="tnum rounded-[10px] bg-surface-muted px-3.5 py-2 text-[15px] font-bold">{children}</span><LockedMark /></>;
const Service = ({ on, off = 'Not connected' }: { on: boolean; off?: string }) => <Badge tone={on ? 'info' : 'neutral'}>{on ? 'Connected' : off}</Badge>;

function Form({ data, canEdit }: { data: Data; canEdit: boolean }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() => toDraft(data.settings)); const [notice, setNotice] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setNotice(''); };
  const reports = Number(d.reportsToRereview);
  const next = { dailyWithdrawalLimitKobo: naira(d.dailyWithdrawalLimitKobo), deliveryStandardKobo: naira(d.deliveryStandardKobo), deliveryExpressKobo: naira(d.deliveryExpressKobo), minPlanPriceKobo: naira(d.minPlanPriceKobo), reportsToRereview: Number.isInteger(reports) ? reports : null, holdNewBank: d.holdNewBank };
  const errors = {
    dailyWithdrawalLimitKobo: next.dailyWithdrawalLimitKobo === null || next.dailyWithdrawalLimitKobo < 1_000_00 ? 'Enter at least ₦1,000' : undefined,
    deliveryStandardKobo: next.deliveryStandardKobo === null ? 'Enter an amount, or 0 for free delivery' : undefined, deliveryExpressKobo: next.deliveryExpressKobo === null ? 'Enter an amount, or 0 for free delivery' : undefined,
    minPlanPriceKobo: next.minPlanPriceKobo === null || next.minPlanPriceKobo < 100_00 ? 'Enter at least ₦100' : undefined,
    reportsToRereview: next.reportsToRereview === null || next.reportsToRereview < 1 || next.reportsToRereview > 20 ? 'Use a number from 1 to 20' : undefined,
  };
  const dirty = JSON.stringify(next) !== JSON.stringify(data.settings); const invalid = Object.values(errors).some(Boolean);
  const save = useMutation({
    mutationFn: () => adminApi<Data>('/settings', { method: 'PATCH', body: next }),
    onSuccess: (r) => { qc.setQueryData(['settings'], r); setD(toDraft(r.settings)); setNotice(r.changed?.length ? `Saved: ${r.changed.join(', ')}. The change is live now and recorded in the audit log.` : 'Nothing changed.'); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  const money = (k: Money, label: string) => <Input aria-label={label} inputMode="decimal" className="h-10 w-32 rounded-[10px] px-2.5 text-right font-semibold" value={d[k]} onChange={(e) => set(k, e.target.value)} />;
  return (
    <>
      <PageHeader title="Platform settings" subtitle="Changes apply straight away. Rules with a padlock are fixed and need a developer to change.">
        <Button variant="primary" disabled={!dirty || invalid || !canEdit || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
      </PageHeader>
      <Notice>{notice}</Notice>
      <fieldset disabled={!canEdit} className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-4">
        <legend className="sr-only">Platform settings</legend>
        <Group title="Trip plan sales">
          <Row title="Platform fee" hint="Taken from every sale. The seller keeps the rest."><Fixed>{data.locked.planFeePercent}%</Fixed></Row>
          <Row title="Sales open after the seller's trip ends" hint="At 6:00 am the next day. Free sharing is always allowed."><Fixed>On</Fixed></Row>
          <Row title="Sellers need a verified ID to be paid" hint="Anyone can list a plan"><Fixed>On</Fixed></Row>
          <Row title="Lowest price for a paid plan (₦)" error={errors.minPlanPriceKobo}>{money('minPlanPriceKobo', 'Lowest plan price in naira')}</Row>
        </Group>
        <Group title="Travel advice">
          <Row title="Verified only after staff approval" hint="Every new piece of advice goes to the review queue"><Fixed>On</Fixed></Row>
          <Row title="Send verified advice back to review after" hint="reports from different travellers" error={errors.reportsToRereview}><Input aria-label="Number of reports" type="number" min={1} max={20} className="h-10 w-16 rounded-[10px] px-0 text-center text-[15px] font-semibold" value={d.reportsToRereview} onChange={(e) => set('reportsToRereview', e.target.value)} /></Row>
        </Group>
        <Group title="Wallet">
          <Row title="Daily withdrawal limit per traveller (₦)" hint="Anything over this waits for Finance" error={errors.dailyWithdrawalLimitKobo}>{money('dailyWithdrawalLimitKobo', 'Daily withdrawal limit in naira')}</Row>
          <Row title="Hold withdrawals to a newly added bank" hint={`For the first ${data.locked.newBankHoldHours} hours, until Finance releases them`}><Switch label="Hold withdrawals to new banks" checked={d.holdNewBank} onCheckedChange={(v) => set('holdNewBank', v)} /></Row>
        </Group>
        <Group title="Shop delivery">
          <Row title="Standard delivery fee (₦)" hint="Enter 0 for free delivery" error={errors.deliveryStandardKobo}>{money('deliveryStandardKobo', 'Standard delivery fee in naira')}</Row>
          <Row title="Express delivery fee (₦)" error={errors.deliveryExpressKobo}>{money('deliveryExpressKobo', 'Express delivery fee in naira')}</Row>
        </Group>
        <Group title="Connected services">
          <Row title="Email for sign-in codes" hint="Until a mail server is set, codes are only shown on the test server"><Service on={data.services.email} off="Not set up" /></Row>
          <Row title="Payments partner" hint="Bank transfers, cards and payouts"><Service on={data.services.payments} /></Row>
          <Row title="ID checks (BVN and NIN)"><Service on={data.services.identity} /></Row>
          <Row title="Cloud storage for photos, video and voice" hint="Files are kept on the server for now"><Service on={data.services.cloudStorage} /></Row>
          <Row title="Push notifications"><Service on={data.services.push} /></Row>
        </Group>
      </fieldset>
      {!canEdit && <p className="text-sm text-ink-muted">Your role can view settings but not change them.</p>}
    </>
  );
}

export default function Settings() {
  const canEdit = accessFor(useSession((s) => s.admin)?.role, 'settings') === 'Edit';
  const { data, error } = useQuery({ queryKey: ['settings'], queryFn: () => adminApi<Data>('/settings') });
  if (!data) return <p className="text-sm text-ink-muted">{error ? errorMessage(error) : 'Loading settings…'}</p>;
  return <Form data={data} canEdit={canEdit} />;
}
