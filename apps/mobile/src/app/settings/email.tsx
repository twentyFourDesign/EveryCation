import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Input, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Moves the account to a new email address. It changes only after the code sent there is entered. */
export default function ChangeEmail() {
  const { me, changeEmail, confirmEmail } = useSession();
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [sent, setSent] = useState<string | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);

  async function send() {
    setError(''); setBusy(true);
    try { const r = await changeEmail(email.trim()); setSent(r.sentTo); if (r.devCode) setCode(r.devCode); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    setError(''); setBusy(true);
    try { await confirmEmail(email.trim(), code.trim()); setDone(true); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  if (done) return (
    <Screen title="Email address" footer={<Button label="DONE" onPress={() => router.back()} />}>
      <T v="h2">Email changed</T><T className="text-ink-muted">From now on, sign in with {me?.email}. Codes and receipts go there too.</T>
    </Screen>
  );
  return (
    <Screen title="Email address" footer={sent
      ? <><Button label={busy ? 'CHECKING…' : 'CONFIRM NEW EMAIL'} disabled={busy || !/^\d{6}$/.test(code.trim())} onPress={confirm} /><Button variant="ghost" label="Use a different email" onPress={() => { setSent(null); setCode(''); }} /></>
      : <Button label={busy ? 'SENDING…' : 'SEND CODE'} disabled={busy || email.trim().length < 5} onPress={send} />}>
      <T className="text-ink-muted">You sign in with <T v="strong">{me?.email ?? 'no email yet'}</T>. To change it, we send a code to the new address first.</T>
      {sent ? (
        <>
          <T>Enter the 6-digit code we sent to {sent}.</T>
          <Input label="Code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" autoComplete="one-time-code" maxLength={6} />
        </>
      ) : (
        <Input label="New email address" value={email} onChangeText={setEmail} placeholder="ada@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} />
      )}
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
