'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminSample, type Access, type AdminRole } from '@everycation/shared';

interface Session {
  admin: { name: string; initials: string; role: AdminRole; email: string } | null;
  signIn: (email: string) => void;
  signOut: () => void;
}

/**
 * Demo session kept in the browser. In production the API issues an httpOnly session
 * cookie after password + TOTP, and this store only mirrors `GET /admin/me`.
 */
export const useSession = create<Session>()(
  persist(
    (set) => ({
      admin: null,
      signIn: (email) => set({ admin: { ...adminSample.currentAdmin, email } }),
      signOut: () => set({ admin: null }),
    }),
    { name: 'everycation-admin-session' },
  ),
);

/** What a role may do in an area, from the same table shown on the Admins page. */
export function accessFor(role: AdminRole, areaKey: string): Access {
  const row = adminSample.permissions.find((p) => p.key === areaKey);
  return row ? (row.access[adminSample.roles.indexOf(role)] ?? null) : 'Edit';
}
