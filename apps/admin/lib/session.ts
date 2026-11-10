'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Access } from '@everycation/shared';
import { adminApi, setSignedOutHandler, setToken } from './api';

export type ApiRole = 'super_admin' | 'moderator' | 'finance' | 'shop_ops' | 'support';
export const ROLE_LABEL: Record<ApiRole, string> = { super_admin: 'Super admin', moderator: 'Moderator', finance: 'Finance', shop_ops: 'Shop ops', support: 'Support' };
interface Me { admin: { id: string; email: string; name: string; role: ApiRole }; access: Record<string, 'edit' | 'view' | null>; counts: { heldWithdrawals: number; adviceWaiting: number; openReports: number } }

interface Session {
  token: string | null;
  admin: (Me['admin'] & { initials: string; roleLabel: string }) | null;
  access: Me['access'];
  counts: Me['counts'];
  signIn: (email: string, password: string, code: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const empty = { token: null, admin: null, access: {}, counts: { heldWithdrawals: 0, adviceWaiting: 0, openReports: 0 } };

/**
 * The signed-in staff member. The token lives in this browser tab only (sessionStorage),
 * so closing the tab signs you out; the API ends every session after 12 hours.
 */
export const useSession = create<Session>()(
  persist(
    (set, get) => ({
      ...empty,
      signIn: async (email, password, code) => {
        const { token } = await adminApi<{ token: string }>('/auth/login', { method: 'POST', body: { email, password, code } });
        setToken(token); set({ token });
        await get().refresh();
      },
      refresh: async () => {
        const me = await adminApi<Me>('/me');
        set({ admin: { ...me.admin, initials: initials(me.admin.name), roleLabel: ROLE_LABEL[me.admin.role] }, access: me.access, counts: me.counts });
      },
      signOut: async () => { await adminApi('/auth/logout', { method: 'POST' }).catch(() => {}); setToken(null); set(empty); },
    }),
    { name: 'everycation-admin', storage: createJSONStorage(() => sessionStorage), onRehydrateStorage: () => (state) => setToken(state?.token ?? null) },
  ),
);
setSignedOutHandler(() => { setToken(null); useSession.setState(empty); });

/** What the signed-in role may do in an area, as the API reports it. The API enforces the same table. */
export function accessFor(_role: unknown, areaKey: string): Access {
  const a = useSession.getState().access[areaKey];
  return a === 'edit' ? 'Edit' : a === 'view' ? 'View' : null;
}
