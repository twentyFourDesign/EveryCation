'use client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

let token: string | null = null;
let onSignedOut: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

/** Calls the staff API under /admin with the signed-in staff token. */
export async function adminApi<T>(path: string, init: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin${path}`, { method: init.method ?? 'GET', headers: { ...(init.body !== undefined && !(init.body instanceof FormData) && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) }, body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body) });
  } catch { throw new ApiError(0, 'offline', 'The server cannot be reached. Check that the API is running.'); }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === 'admin_signed_out') onSignedOut();
    throw new ApiError(res.status, data.code ?? 'error', data.message ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

export const naira = (kobo: number, opts: { sign?: boolean } = {}) => `${kobo < 0 ? '−' : opts.sign && kobo > 0 ? '+' : ''}₦${(Math.abs(kobo) / 100).toLocaleString('en-NG')}`;
export const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000)); return m < 1 ? 'just now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Uploads one photo for a product or a place and returns its address. */
export async function uploadPhoto(folder: 'products' | 'places', file: File) { const form = new FormData(); form.append('file', file); return (await adminApi<{ url: string }>(`/uploads/${folder}`, { method: 'POST', body: form })).url; }
