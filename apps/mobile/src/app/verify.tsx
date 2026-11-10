import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { otpSchema } from '@everycation/shared';
import { Button, Screen, T, cx } from '@/ui';
import { useApp } from '@/lib/store';

export default function VerifyCode() {
  const { to = 'your phone' } = useLocalSearchParams<{ to?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [wait, setWait] = useState(45);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const signIn = useApp((s) => s.signIn);
  useEffect(() => { const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000); return () => clearInterval(t); }, []);
  function verify() {
    const r = otpSchema.safeParse({ code });
    if (!r.success) return setError(r.error.issues[0]!.message);
    signIn(to); router.replace('/explore');
  }
  return (
    <Screen title="" footer={<Button label="VERIFY" onPress={verify} />}>
      <View className="gap-1"><T v="h1">Enter the code</T>
        <T className="text-ink-muted">We sent a 6-digit code to {to}. <Text accessibilityRole="link" onPress={() => router.back()} className="font-pop-sb text-heading-blue">Change</Text></T></View>
      <Pressable accessibilityLabel="6-digit code" onPress={() => input.current?.focus()} className="flex-row justify-between">
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} className={cx('h-14 w-[14.5%] items-center justify-center rounded-xl border-[1.5px]', error ? 'border-danger' : i === code.length ? 'border-navy' : 'border-control-border')}>
            <Text className="font-pop-sb text-xl text-ink">{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput ref={input} value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad" autoFocus textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6}
        accessibilityLabel="Verification code" className="absolute h-px w-px opacity-0" />
      {!!error && <Text accessibilityRole="alert" className="font-pop-md text-xs text-danger">{error}</Text>}
      <T v="small">Didn&apos;t get it? {wait > 0 ? `Resend in 0:${String(wait).padStart(2, '0')}` : <Text accessibilityRole="button" onPress={() => setWait(45)} className="font-pop-sb text-heading-blue">Resend code</Text>}</T>
    </Screen>
  );
}
