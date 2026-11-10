import { create } from 'zustand';
import { api, clearTokens, refreshSession, saveTokens, setSignedOutHandler } from './api';
import { queryClient } from './query';

export interface Me { id: string; phone: string | null; email: string | null; name: string | null; handle: string | null; kycStatus: 'none' | 'verified' | 'failed'; hasPin: boolean; walletFrozen: boolean }
interface Session {
  status: 'loading' | 'guest' | 'signedIn';
  me: Me | null;
  /** Runs once at launch: resumes the last session if the phone still holds a valid refresh token. */
  restore: () => Promise<void>;
  requestCode: (phone: string) => Promise<{ sentTo: string; resendInSeconds: number; devCode?: string }>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<Session>((set, get) => ({
  status: 'loading',
  me: null,
  restore: async () => {
    try {
      if (!(await refreshSession())) return set({ status: 'guest', me: null });
      set({ status: 'signedIn', me: await api<Me>('/auth/me') });
    } catch { set({ status: 'guest', me: null }); }
  },
  requestCode: (phone) => api('/auth/otp/request', { method: 'POST', body: { phone }, auth: false }),
  verifyCode: async (phone, code) => {
    const tokens = await api<{ accessToken: string; refreshToken: string }>('/auth/otp/verify', { method: 'POST', body: { phone, code }, auth: false });
    await saveTokens(tokens);
    set({ status: 'signedIn', me: await api<Me>('/auth/me') });
  },
  signOut: async () => {
    if (get().status === 'signedIn') await api('/auth/logout', { method: 'POST' }).catch(() => {});
    await clearTokens();
    queryClient.clear();
    set({ status: 'guest', me: null });
  },
}));

// The API said the session is over (expired or revoked): drop to guest so screens ask the user to sign in.
setSignedOutHandler(() => { queryClient.clear(); useSession.setState({ status: 'guest', me: null }); });
