import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { otpSchema } from '@everycation/shared';
import { Button, Note, Screen, T, cx } from '@/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function VerifyCode() {
  const p = useLocalSearchParams<{ phone: string; sentTo?: string; devCode?: string }>();
  const { requestCode, verifyCode } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);
  const [devCode, setDevCode] = useState(p.devCode ?? '');
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => { const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000); return () => clearInterval(t); }, []);

  async function verify() {
    const r = otpSchema.safeParse({ code });
    if (!r.success) return setError(r.error.issues[0]!.message);
    setBusy(true); setError('');
    try { await verifyCode(p.phone, code); router.dismissAll(); router.replace(useSession.getState().me?.name ? '/explore' : '/edit-profile?welcome=1'); }
    catch (e) { setError(errorMessage(e)); setCode(''); }
    finally { setBusy(false); }
  }
  async function resend() {
    setError('');
    try { const sent = await requestCode(p.phone); setDevCode(sent.devCode ?? ''); setWait(sent.resendInSeconds); }
    catch (e) { setError(errorMessage(e)); if (e instanceof ApiError && typeof e.extra.retryAfterSeconds === 'number') setWait(e.extra.retryAfterSeconds); }
  }
  return (
    <Screen title="" footer={<Button label={busy ? 'CHECKING…' : 'VERIFY'} disabled={busy} onPress={verify} />}>
      <View className="gap-1"><T v="h1">Enter the code</T>
        <T className="text-ink-muted">We sent a 6-digit code by SMS to {p.sentTo ?? 'your phone'}. <Text accessibilityRole="link" onPress={() => router.back()} className="font-pop-sb text-heading-blue">Change</Text></T></View>
      <Pressable accessibilityLabel="6-digit code" onPress={() => input.current?.focus()} className="flex-row justify-between">
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} className={cx('h-14 w-[14.5%] items-center justify-center rounded-xl border-[1.5px]', error ? 'border-danger' : i === code.length ? 'border-navy' : 'border-control-border')}>
            <Text className="font-pop-sb text-xl text-ink">{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput ref={input} value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad" autoFocus textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6}
        accessibilityLabel="Verification code" className="absolute h-px w-px opacity-0" />
      {!!error && <Text accessibilityRole="alert" className="font-pop-md text-[13px] text-danger">{error}</Text>}
      <T v="small">Didn&apos;t get it? {wait > 0 ? `Resend in 0:${String(wait).padStart(2, '0')}` : <Text accessibilityRole="button" onPress={resend} className="font-pop-sb text-heading-blue">Resend code</Text>}</T>
      {!!devCode && <Note>{`Test server: your code is ${devCode}. Real SMS is sent once a provider is connected.`}</Note>}
    </Screen>
  );
}
