import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { api, API_URL, ApiError, saveTokens } from './api';
import { useSession, type Me } from './session';

/** Which sign-in buttons to show. The server turns each on once its keys are set, so the app never shows a button that cannot work. */
export const useProviders = () => useQuery({ queryKey: ['auth-providers'], queryFn: () => api<{ google: boolean; apple: boolean; calendar: boolean }>('/auth/providers', { auth: false }), staleTime: 300_000 });

const problems: Record<string, string> = {
  google_failed: 'Google could not confirm who you are. Please try again.',
  email_in_use: 'That email already belongs to an account that signs in with a different Google account.',
  account_suspended: 'This account is suspended. Contact support.',
};
/** Thrown when the person closes the Google or Apple sheet. Callers show nothing for this. */
export class Cancelled extends Error {}

/** Opens a Google page in the system browser and waits for it to send the person back to `path` in the app. Returns what came back in the address. */
export async function throughGoogle(startUrl: string, returnTo: string) {
  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnTo);
  if (result.type !== 'success') throw new Cancelled();
  const params = Linking.parse(result.url).queryParams ?? {};
  const error = typeof params.error === 'string' ? params.error : '';
  if (error === 'cancelled') throw new Cancelled();
  if (error) throw new Error(problems[error] ?? problems.google_failed);
  return params;
}

async function finish(tokens: { accessToken: string; refreshToken: string }) {
  await saveTokens(tokens);
  useSession.setState({ status: 'signedIn', me: await api<Me>('/auth/me') });
}

/** Google sign-in goes through our server, so the same setup works on iPhone, Android and the web. */
export async function signInWithGoogle() {
  const returnTo = Linking.createURL('signed-in');
  const params = await throughGoogle(`${API_URL}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`, returnTo);
  if (typeof params.code !== 'string') throw new Error(problems.google_failed);
  await finish(await api('/auth/handoff', { method: 'POST', body: { code: params.code }, auth: false }));
}

export const appleAvailable = () => (Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false));
export async function signInWithApple() {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try { credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] }); }
  catch (e) { if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new Cancelled(); throw new Error('Apple could not confirm who you are. Please try again.'); }
  if (!credential.identityToken) throw new Error('Apple could not confirm who you are. Please try again.');
  // Apple shares the name only the first time someone signs in to an app, so send it along when it is there.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim() || undefined;
  await finish(await api('/auth/apple', { method: 'POST', body: { identityToken: credential.identityToken, name }, auth: false }));
}

// ───────────── Google Calendar ─────────────
export interface CalendarStatus { available: boolean; connected: boolean; account: string | null; calendar: string | null; lastSyncedAt: string | null; problem: string | null; waiting: number }
export const useCalendar = () => { const signedIn = useSession((s) => s.status === 'signedIn'); return useQuery({ queryKey: ['calendar'], queryFn: () => api<CalendarStatus>('/calendar'), enabled: signedIn }); };
/** Sends the traveller to Google to agree, then back to the Calendar view. Resolves once the connection is made. */
export async function connectGoogleCalendar() {
  const returnTo = Linking.createURL('travels', { queryParams: { view: 'Calendar' } });
  const { url } = await api<{ url: string }>('/calendar/google/connect', { method: 'POST', body: { returnTo } });
  const params = await throughGoogle(url, returnTo);
  if (params.calendar !== 'connected') throw new Error('Google Calendar was not connected. Please try again.');
}
export const disconnectGoogleCalendar = () => api<CalendarStatus>('/calendar/google', { method: 'DELETE' });
export { ApiError };
