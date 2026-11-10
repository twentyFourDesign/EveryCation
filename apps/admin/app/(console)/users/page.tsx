'use client';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AdminUser } from '@everycation/shared';
import { adminSample, api, formatNaira } from '@/lib/data';
import { DataTable } from '@/components/data-table';
import { Avatar, Badge, Button, Card, Chips, Input, Notice, PageHeader } from '@/components/ui';
import { accessFor, useSession } from '@/lib/session';

const filters = adminSample.userFilters;
const match: ((u: AdminUser) => boolean)[] = [() => true, (u) => u.kyc === 'Failed', (u) => u.plansSold > 0, (u) => u.status === 'Suspended', () => false];

export default function Users() {
  const role = useSession((s) => s.admin)!.role;
  const canEdit = accessFor(role, 'users') === 'Edit';
  const { data = [] } = useQuery({ queryKey: ['admin', 'users'], queryFn: api.admin.users });
  const [filter, setFilter] = useState(filters[0]!);
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState('30518');
  const [notice, setNotice] = useState('');
  const rows = useMemo(() => data.filter(match[filters.indexOf(filter)]!).filter((u) => (u.name + u.id + u.phone).toLowerCase().includes(term.toLowerCase())), [data, filter, term]);
  const user = data.find((u) => u.id === selected);
  const d = adminSample.userDetail;

  const columns: ColumnDef<AdminUser>[] = [
    { accessorKey: 'name', header: 'User', cell: ({ row: { original: u } }) => <span className="flex flex-col"><b className="font-semibold">{u.name}</b><span className="text-xs text-ink-muted">#{u.id} · {u.phone}</span></span> },
    { accessorKey: 'joined', header: 'Joined', enableSorting: false },
    { accessorKey: 'kyc', header: 'ID check', cell: ({ getValue }) => { const v = getValue<string>(); return <Badge tone={v === 'Failed' ? 'danger' : v === 'Not started' ? 'neutral' : 'info'}>{v}</Badge>; } },
    { accessorKey: 'wallet', header: 'Wallet', meta: { align: 'right' }, cell: ({ getValue }) => { const v = getValue<number | null>(); return v === null ? '—' : formatNaira(v); } },
    { accessorKey: 'plansSold', header: 'Plans sold', meta: { align: 'right' } },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge tone={getValue() === 'Suspended' ? 'danger' : 'neutral'}>{getValue<string>()}</Badge> },
  ];
  const act = (text: string) => setNotice(`${text} for ${user?.name}. Recorded in the audit log.`);

  return (
    <>
      <PageHeader title="Users & KYC" subtitle="61,480 accounts · 22,906 with a verified wallet">
        <div className="relative"><Search aria-hidden className="absolute top-3 left-3.5 size-5 text-ink-muted" /><Input aria-label="Search users" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, phone, email or user ID" className="w-72 max-w-full pl-11" /></div>
      </PageHeader>
      <Chips label="Filter users" value={filter} onChange={setFilter} options={filters} />
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="flex-[3_1_560px] p-2 pb-1"><DataTable caption="Users" data={rows} columns={columns} getRowId={(u) => u.id} onRowClick={(u) => { setSelected(u.id); setNotice(''); }} activeRow={(u) => u.id === selected} empty="No users match." /></Card>
        {user && (
          <Card className="flex flex-[1_1_320px] flex-col gap-4">
            <div className="flex items-center gap-3"><Avatar initials={user.name.replace('@', '').split(/[\s.]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()} className="size-12" /><div className="flex flex-col"><b className="font-semibold">{user.name}</b><span className="text-xs text-ink-muted">{user.id === '30518' ? d.line : `#${user.id} · ${user.phone}`}</span></div></div>
            {user.kyc === 'Failed' && (
              <div className="flex flex-col gap-2 rounded-2xl bg-danger-soft p-3.5">
                <b className="text-sm font-semibold text-danger">{d.kycTitle}</b>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">{d.kycRows.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
                <p className="text-xs">{d.kycNote}</p>
                {canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" variant="navy" onClick={() => act('Name match approved')}>Approve name match</Button><Button size="sm" onClick={() => act('ID document requested')}>Ask for ID document</Button></div>}
              </div>
            )}
            <dl className="flex flex-col text-sm">
              {(user.id === '30518' ? d.facts : [['ID check', user.kyc], ['Wallet', user.wallet === null ? 'Not set up' : formatNaira(user.wallet)], ['Plans sold', String(user.plansSold)], ['Status', user.status]]).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line py-2.5"><dt className="text-ink-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            {canEdit && (
              <div><h3 className="mb-2 text-[13px] font-semibold">Account actions</h3>
                <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => act('PIN reset link sent')}>Reset PIN</Button><Button size="sm" onClick={() => act('Wallet frozen')}>Freeze wallet</Button><Button size="sm" variant="danger" onClick={() => act('Account suspended')}>Suspend account</Button></div>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
