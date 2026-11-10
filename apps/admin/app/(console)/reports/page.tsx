'use client';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { Report } from '@everycation/shared';
import { adminSample, api } from '@/lib/data';
import { DataTable } from '@/components/data-table';
import { Badge, Button, Card, Chips, Notice, PageHeader } from '@/components/ui';
import { useSession } from '@/lib/session';

const types = ['All types', 'Tips', 'Advice', 'Comments', 'Trip plans', 'Profiles'] as const;
type Scope = 'open' | 'mine' | 'closed';

export default function Reports() {
  const me = useSession((s) => s.admin)!;
  const { data = [] } = useQuery({ queryKey: ['admin', 'reports'], queryFn: api.admin.reports });
  const [type, setType] = useState<(typeof types)[number]>('All types');
  const [scope, setScope] = useState<Scope>('open');
  const [closed, setClosed] = useState<Record<string, string>>({});
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('R-1');
  const [decision, setDecision] = useState(adminSample.reportDetail.decisions[0]!);
  const [suspend, setSuspend] = useState(true);
  const [tell, setTell] = useState(true);
  const [notice, setNotice] = useState('');

  const who = (r: Report) => assigned[r.id] ?? r.assigned;
  const rows = useMemo(() => data.filter((r) => type === 'All types' || r.type === type)
    .filter((r) => scope === 'closed' ? closed[r.id] : !closed[r.id] && (scope === 'open' || who(r) === me.name)),
    [data, type, scope, closed, assigned, me.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = data.filter((r) => !closed[r.id]);
  const current = data.find((r) => r.id === selected);
  const d = adminSample.reportDetail;

  const columns: ColumnDef<Report>[] = [
    { accessorKey: 'priority', header: 'Priority', cell: ({ getValue }) => <Badge tone={getValue() === 'High' ? 'danger' : 'neutral'}>{getValue<string>()}</Badge> },
    { accessorKey: 'item', header: 'Item', cell: ({ getValue }) => <b className="font-semibold">{getValue<string>()}</b> },
    { accessorKey: 'reason', header: 'Reason' },
    { accessorKey: 'reports', header: 'Reports', meta: { align: 'right' } },
    { accessorKey: 'opened', header: 'Opened', enableSorting: false },
    { id: 'assigned', header: 'Assigned', enableSorting: false, cell: ({ row }) => who(row.original) ?? <button className="cursor-pointer font-semibold text-heading-blue" onClick={(e) => { e.stopPropagation(); setAssigned((s) => ({ ...s, [row.original.id]: me.name })); }}>Assign to me</button> },
  ];

  return (
    <>
      <PageHeader title="Reports" subtitle="What users flagged across tips, advice, comments, plans and profiles" />
      <div className="flex flex-wrap justify-between gap-3">
        <Chips label="Type" value={type} onChange={setType} options={types} />
        <Chips label="Status" value={scope} onChange={setScope} options={[{ value: 'open', label: `Open · ${17 - Object.keys(closed).length}` }, { value: 'mine', label: `Assigned to me · ${open.filter((r) => who(r) === me.name).length}` }, { value: 'closed', label: 'Closed' }]} />
      </div>
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="flex-[3_1_520px] p-2 pb-1"><DataTable caption="Reports" data={rows} columns={columns} getRowId={(r) => r.id} onRowClick={(r) => setSelected(r.id)} activeRow={(r) => r.id === selected} empty="No reports match these filters." /></Card>
        {current && (
          <Card className="flex flex-[2_1_360px] flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold">{current.type.replace(/s$/, '')} report</h2><Badge tone={current.priority === 'High' ? 'danger' : 'neutral'}>{current.priority} · {current.reports} reports</Badge></div>
            {current.id === 'R-1' ? (
              <div className="flex gap-3">
                <Image src="/img/giza-traveller.jpg" alt="" width={72} height={72} className="size-[72px] rounded-xl object-cover" />
                <div className="flex flex-col text-sm"><b className="font-semibold">{d.title}</b><span className="text-ink-muted">by {d.by}</span><span className="text-xs text-ink-muted">{d.dates}</span></div>
              </div>
            ) : <p className="text-sm font-semibold">{current.item}</p>}
            <div>
              <h3 className="mb-1 text-[13px] font-semibold">What reporters said</h3>
              <blockquote className="rounded-xl bg-surface-muted p-3 text-sm">{current.id === 'R-1' ? `"${d.quote}"` : `Reported for: ${current.reason.toLowerCase()}.`}</blockquote>
              {current.reports > 1 && <p className="mt-1 text-xs text-ink-muted">+ {current.reports - 1} similar reports</p>}
            </div>
            {closed[current.id] ? <Badge>{closed[current.id]}</Badge> : (
              <>
                <fieldset className="flex flex-col gap-2 text-sm">
                  <legend className="mb-1 text-[13px] font-semibold">Decision</legend>
                  {(current.type === 'Trip plans' ? d.decisions : ['Remove it', 'Keep it']).map((o) => <label key={o} className="flex items-center gap-2.5"><input type="radio" name="decision" checked={decision === o} onChange={() => setDecision(o)} className="size-4 accent-navy" />{o}</label>)}
                </fieldset>
                <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={suspend} onChange={(e) => setSuspend(e.target.checked)} className="size-4 accent-navy" />Suspend the account{current.type === 'Trip plans' && ' and freeze their wallet'}</label>
                <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} className="size-4 accent-navy" />Tell the {current.reports} reporter{current.reports > 1 && 's'} what we did</label>
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="primary" onClick={() => { setClosed((s) => ({ ...s, [current.id]: decision })); setNotice(`Decision applied to ${current.item}: ${decision.toLowerCase()}.`); }}>Apply decision</Button>
                  <Button onClick={() => { setAssigned((s) => ({ ...s, [current.id]: 'Ada E.' })); setNotice('Assigned to Finance (Ada E.).'); }}>Assign to Finance</Button>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
