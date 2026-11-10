import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Input, Note, Screen, T } from './index';

/**
 * Wraps a screen that posts under the user's name. Guests are asked to sign in,
 * and a new account is asked once for the name other travellers will see.
 */
export function NameGate({ title, why, children }: { title: string; why: string; children: ReactNode }) {
  const { status, me, setName } = useSession();
  const [name, setNameText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (status !== 'signedIn') return (
    <Screen title={title}><View className="gap-4 pt-10"><T v="h2" className="text-center">Sign in first</T><T className="text-center text-ink-muted">{why}</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View></Screen>
  );
  if (me?.name) return <>{children}</>;
  const save = async () => { setBusy(true); setError(''); try { await setName(name.trim()); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  return (
    <Screen title={title} footer={<Button disabled={busy || name.trim().length < 2} label={busy ? 'SAVING…' : 'CONTINUE'} onPress={save} />}>
      <View className="gap-1"><T v="h2">What should we call you?</T><T className="text-ink-muted">Your name shows next to what you share. You can use a first name and initial, like Amaka O.</T></View>
      <Input label="Your name" value={name} onChangeText={setNameText} placeholder="Amaka O." maxLength={60} autoFocus onSubmitEditing={save} />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
