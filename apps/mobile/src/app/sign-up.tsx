import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { emailSchema, phoneSchema } from '@everycation/shared';
import { Button, FormInput, Mark, Screen, Segmented, T } from '@/ui';

export default function SignUp() {
  const [mode, setMode] = useState<'Phone number' | 'Email'>('Phone number');
  const phone = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } });
  const email = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });
  const next = (to: string) => router.push({ pathname: '/verify', params: { to } });
  const submit = mode === 'Email' ? email.handleSubmit((v) => next(v.email)) : phone.handleSubmit((v) => next(`+234 ${v.phone}`));
  return (
    <Screen title="">
      <Mark size={44} color="brand" />
      <View className="gap-1"><T v="h1">Create your account</T><T className="text-ink-muted">Save trips, share tips and start your travel wallet.</T></View>
      <Segmented options={['Phone number', 'Email'] as const} value={mode} onChange={setMode} />
      {mode === 'Email'
        ? <FormInput control={email.control} name="email" label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        : (
          <View className="gap-1.5">
            <T v="label">Phone number</T>
            <View className="flex-row items-start gap-2">
              <View className="h-[52px] justify-center rounded-xl border-[1.5px] border-control-border px-3"><Text className="font-pop-md text-[15px] text-ink">NG +234</Text></View>
              <View className="flex-1"><FormInput control={phone.control} name="phone" accessibilityLabel="Phone number" placeholder="803 123 4821" keyboardType="phone-pad" autoComplete="tel" /></View>
            </View>
          </View>
        )}
      <Button label="CONTINUE" onPress={() => submit()} />
      <View className="flex-row items-center gap-3"><View className="h-px flex-1 bg-line" /><T v="small">or</T><View className="h-px flex-1 bg-line" /></View>
      <Button variant="outline" label="Continue with Google" onPress={() => next('your Google account')} />
      <Button variant="outline" label="Continue with Apple" onPress={() => next('your Apple account')} />
      <Pressable accessibilityRole="link" onPress={() => submit()} className="items-center py-2"><T v="small">Already have an account? <Text className="font-pop-sb text-heading-blue">Log in</Text></T></Pressable>
      <T v="small" className="text-center text-xs">By continuing you agree to our Terms and Privacy policy.</T>
    </Screen>
  );
}
