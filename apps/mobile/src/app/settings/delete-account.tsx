import { formatNaira } from '@everycation/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useWallet } from '@/lib/wallet';

const GONE = ['Your name, username, photo, email and home city', 'Your moments, tips, comments and advice', 'Your sign-in on every phone and browser'];

/** Permanent account deletion. App stores require that people can do this inside the app. */
export default function DeleteAccount() {
  const { status, deleteAccount } = useSession();
  const wallet = useWallet().data;
  const [typed, setTyped] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [gone, setGone] = useState(false);
  const money = (wallet?.total ?? 0) > 0;

  async function remove() {
    setError(''); setBusy(true);
    try { await deleteAccount(); setGone(true); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (gone) return (
    <Screen title="" back={false} footer={<Button label="CLOSE" onPress={() => { router.dismissAll(); router.replace('/'); }} />}>
      <View className="gap-3 pt-12"><T v="h2">Your account is deleted</T><T className="text-ink-muted">Thank you for travelling with EveryCation. You can sign up again any time with a fresh account.</T></View>
    </Screen>
  );
  if (status !== 'signedIn') return <Screen title="Delete account"><T>Sign in to the account you want to delete.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></Screen>;
  return (
    <Screen title="Delete account" footer={<Button variant="danger" label={busy ? 'DELETING…' : 'DELETE MY ACCOUNT'} disabled={busy || money || typed.trim() !== 'DELETE'} onPress={remove} />}>
      <T v="h2">This cannot be undone</T>
      <View className="gap-1.5 rounded-card bg-danger-soft p-4">
        <T v="strong">What we delete</T>
        {GONE.map((g) => <T key={g}>• {g}</T>)}
      </View>
      <T v="small">Records of money moved through your wallet are kept, without your name or contact details, because the law requires it. Your private trips and checklists can no longer be opened by anyone.</T>
      {money && wallet && (
        <Note tone="gold">You still have {formatNaira(wallet.total)} in your wallet and savings goals. Withdraw it to your bank first, then come back here.</Note>
      )}
      {money && <Button variant="outline" label="Go to wallet" onPress={() => router.push('/wallet')} />}
      <Input label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
