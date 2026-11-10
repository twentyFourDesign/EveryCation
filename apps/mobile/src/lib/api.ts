import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Where the API lives. Set EXPO_PUBLIC_API_URL per build; on a phone, use your computer's LAN address in development. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');
/** Shows the test-deposit button. On in development builds, or when EXPO_PUBLIC_DEV_TOOLS=1. */
export const DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === '1';

/** An error from the API, with the stable `code` screens switch on and a message written for the user. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly extra: Record<string, unknown> = {}) { super(message); }
}
export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

// Refresh token: Keychain/Keystore on phones. On web it stays in memory for the tab's session storage.
const KEY = 'everycation.refresh';
const store = {
  get: async () => (Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(KEY) ?? null : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => (Platform.OS === 'web' ? globalThis.sessionStorage?.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })),
  clear: async () => (Platform.OS === 'web' ? globalThis.sessionStorage?.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
};

interface Tokens { accessToken: string; refreshToken: string }
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: () => void = () => {};
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

export async function saveTokens(t: Tokens) { accessToken = t.accessToken; await store.set(t.refreshToken); }
export async function clearTokens() { accessToken = null; await store.clear(); }

async function raw(path: string, init: RequestInit): Promise<Response> {
  try { return await fetch(API_URL + path, init); }
  catch { throw new ApiError(0, 'offline', 'We could not reach EveryCation. Check your connection and try again.'); }
}

/** Swaps the stored refresh token for a new pair. One refresh at a time, shared by every waiting request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await store.get();
    if (!refreshToken) return false;
    const res = await raw('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
    if (!res.ok) { if (res.status === 401) await clearTokens(); return false; }
    await saveTokens((await res.json()) as Tokens);
    return true;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export interface RequestOptions { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; idempotencyKey?: string; auth?: boolean }

export async function api<T>(path: string, { method = 'GET', body, idempotencyKey, auth = true }: RequestOptions = {}): Promise<T> {
  const send = () => raw(path, {
    method,
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(auth && accessToken && { Authorization: `Bearer ${accessToken}` }), ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let res = await send();
  if (res.status === 401 && auth) {
    if (await refreshSession()) res = await send();
    if (res.status === 401) { await clearTokens(); onSignedOut(); }
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const { code, message, ...extra } = data;
    throw new ApiError(res.status, typeof code === 'string' ? code : 'error', typeof message === 'string' ? message : 'Something went wrong. Please try again.', extra);
  }
  return data as T;
}
