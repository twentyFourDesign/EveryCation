'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminSample } from '@/lib/data';
import { Button, Card, Field, Input, Notice, PageHeader, Select } from '@/components/ui';
import { adminApi, when } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { ROLE_LABEL, type ApiRole } from '@/lib/session';

interface StaffRow { id: string; name: string; email: string; role: ApiRole; lastActiveAt: string | null }
interface AuditRow { id: string; at: string; admin: string; action: string; item: string; ip: string | null }

const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-[11px] text-sm whitespace-nowrap';

export default function Admins() {
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => adminApi<StaffRow[]>('/staff') });
  const { data: audit = [] } = useQuery({ queryKey: ['audit'], queryFn: () => adminApi<AuditRow[]>('/audit') });
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(adminSample.roles[4]!);
  const [notice, setNotice] = useState('');
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <>
      <PageHeader title="Admins & audit log" subtitle={`${staff.length} staff · two-factor sign-in required for everyone`}>
        <Button variant="primary" onClick={() => setInviting((v) => !v)}>+ Invite admin</Button>
      </PageHeader>
      {inviting && (
        <form className="flex flex-wrap items-end gap-3 rounded-card bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (!valid) return; setNotice(`Inviting from the console is not connected yet. On the server, run: pnpm --filter @everycation/api admin:create ${email} "Full Name" ${role.toLowerCase().replace(' ', '_')}`); setEmail(''); setInviting(false); }}>
          <div className="flex-[2_1_240px]"><Field label="Work email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@everycation.app" /></Field></div>
          <div className="flex-[1_1_160px]"><Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>{adminSample.roles.map((r) => <option key={r}>{r}</option>)}</Select></Field></div>
          <Button type="submit" variant="navy" disabled={!valid}>Send invite</Button>
        </form>
      )}
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="flex-[2_1_420px] overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="sr-only">Staff</caption>
            <thead><tr>{['Admin', 'Role', 'Last active'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>{staff.map((s) => <tr key={s.id}><td className={td}><b className="font-semibold">{s.name}</b><span className="block text-xs text-ink-muted">{s.email}</span></td><td className={td}>{ROLE_LABEL[s.role]}</td><td className={td}>{s.lastActiveAt ? when(s.lastActiveAt) : 'Never signed in'}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card aria-label="Role permissions" className="flex-[3_1_520px] overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="sr-only">What each role can do</caption>
            <thead><tr><th scope="col" className={th}>Area</th>{adminSample.roles.map((r) => <th key={r} scope="col" className={th}>{r}</th>)}</tr></thead>
            <tbody>{adminSample.permissions.map((p) => (
              <tr key={p.key}><th scope="row" className={`${td} text-left font-normal`}>{p.area}</th>
                {p.access.map((a, i) => <td key={i} className={td}>{a === null ? <span className="text-ink-muted" aria-label="No access">—</span> : a === 'View' ? 'View' : <b className="font-semibold text-navy">{a}</b>}</td>)}</tr>
            ))}</tbody>
          </table>
        </Card>
      </div>
      <Card className="flex flex-col gap-2.5 p-4.5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Audit log</h2><Button size="sm" onClick={() => downloadCsv('audit-log.csv', audit.map((a) => ({ when: a.at, admin: a.admin, action: a.action, item: a.item, ip: a.ip ?? '' })))}>Export</Button></div>
        <div className="overflow-x-auto">
          <table className="w-full"><caption className="sr-only">Audit log</caption>
            <thead><tr>{['When', 'Admin', 'Action', 'Item', 'From'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id}><td className={td}>{when(a.at)}</td><td className={td}>{a.admin}</td><td className={td}>{a.action}</td><td className={td}>{a.item}</td><td className={`${td} text-ink-muted`}>{a.ip ?? '—'}</td></tr>)}
              {audit.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-ink-muted">No staff actions recorded yet.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
