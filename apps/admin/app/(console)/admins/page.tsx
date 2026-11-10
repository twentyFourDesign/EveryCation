'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminSample } from '@/lib/data';
import { Button, Card, Field, Input, Notice, PageHeader, Select } from '@/components/ui';
import { adminApi, errorMessage, when } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { accessFor, ROLE_LABEL, useSession, type ApiRole } from '@/lib/session';

interface StaffRow { id: string; name: string; email: string; role: ApiRole; active: boolean; lastActiveAt: string | null }
interface Invite { email: string; temporaryPassword: string; authenticatorSecret: string; authenticatorLink: string }
interface AuditRow { id: string; at: string; admin: string; action: string; item: string; ip: string | null }

const th = 'border-b border-line px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted';
const td = 'border-b border-line px-3 py-[11px] text-sm whitespace-nowrap';

export default function Admins() {
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => adminApi<StaffRow[]>('/staff') });
  const { data: audit = [] } = useQuery({ queryKey: ['audit'], queryFn: () => adminApi<AuditRow[]>('/audit') });
  const qc = useQueryClient();
  const me = useSession((x) => x.admin);
  const canEdit = accessFor(me?.role, 'settings') === 'Edit';
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState(''); const [name, setName] = useState('');
  const [role, setRole] = useState<ApiRole>('support');
  const [notice, setNotice] = useState('');
  const [invited, setInvited] = useState<Invite | null>(null);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && name.trim().length >= 2;
  const invite = useMutation({
    mutationFn: () => adminApi<Invite>('/staff', { method: 'POST', body: { email, name: name.trim(), role } }),
    onSuccess: (r) => { setInvited(r); setNotice(''); setEmail(''); setName(''); setInviting(false); qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['audit'] }); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  const setActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => adminApi(`/staff/${v.id}/active`, { method: 'POST', body: { active: v.active } }),
    onSuccess: (_, v) => { setNotice(v.active ? 'Account turned back on.' : 'Account turned off. They have been signed out.'); qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['audit'] }); },
    onError: (e) => setNotice(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Admins & audit log" subtitle={`${staff.length} staff · two-factor sign-in required for everyone`}>
        {canEdit && <Button variant="primary" onClick={() => { setInviting((v) => !v); setInvited(null); }}>+ Invite admin</Button>}
      </PageHeader>
      {inviting && (
        <form className="flex flex-wrap items-end gap-3 rounded-card bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (valid) invite.mutate(); }}>
          <div className="flex-[2_1_200px]"><Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bisi L." /></Field></div>
          <div className="flex-[2_1_240px]"><Field label="Work email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@everycation.app" /></Field></div>
          <div className="flex-[1_1_160px]"><Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value as ApiRole)}>{(Object.keys(ROLE_LABEL) as ApiRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field></div>
          <Button type="submit" variant="navy" disabled={!valid || invite.isPending}>{invite.isPending ? 'Creating…' : 'Create account'}</Button>
        </form>
      )}
      {invited && (
        <section role="status" className="flex flex-col gap-3 rounded-card border-2 border-gold bg-white p-5">
          <div><h2 className="text-base font-semibold">Account created for {invited.email}</h2><p className="text-sm text-ink-muted">Copy these now and pass them on over a safe channel. They are shown once and cannot be recovered.</p></div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">Temporary password</dt><dd className="font-mono font-semibold break-all">{invited.temporaryPassword}</dd>
            <dt className="text-ink-muted">Authenticator secret</dt><dd className="font-mono font-semibold break-all">{invited.authenticatorSecret}</dd>
            <dt className="text-ink-muted">Authenticator link</dt><dd className="font-mono text-xs break-all">{invited.authenticatorLink}</dd>
          </dl>
          <div className="flex gap-2.5"><Button size="sm" variant="navy" onClick={() => navigator.clipboard.writeText(`EveryCation Admin\nEmail: ${invited.email}\nTemporary password: ${invited.temporaryPassword}\nAuthenticator secret: ${invited.authenticatorSecret}`)}>Copy all</Button><Button size="sm" onClick={() => setInvited(null)}>I have saved them</Button></div>
        </section>
      )}
      <Notice>{notice}</Notice>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="flex-[2_1_420px] overflow-x-auto p-2 pb-1">
          <table className="w-full"><caption className="sr-only">Staff</caption>
            <thead><tr>{['Admin', 'Role', 'Last active', ''].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>{staff.map((s) => <tr key={s.id}><td className={td}><b className="font-semibold">{s.name}</b><span className="block text-xs text-ink-muted">{s.email}</span></td><td className={td}>{ROLE_LABEL[s.role]}</td><td className={td}>{!s.active ? 'Turned off' : s.lastActiveAt ? when(s.lastActiveAt) : 'Never signed in'}</td><td className={td}>{canEdit && s.id !== me?.id && <button className="cursor-pointer text-[13px] font-semibold text-heading-blue" onClick={() => setActive.mutate({ id: s.id, active: !s.active })}>{s.active ? 'Turn off' : 'Turn on'}</button>}</td></tr>)}</tbody>
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
