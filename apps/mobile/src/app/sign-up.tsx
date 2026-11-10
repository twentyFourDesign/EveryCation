import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { phoneSchema } from '@everycation/shared';
import { Button, FormInput, Mark, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function SignUp() {
  const requestCode = useSession((s) => s.requestCode);
  const { control, handleSubmit, formState: { isSubmitting } } = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } });
  const [error, setError] = useState('');
  const [soon, setSoon] = useState('');
  const submit = handleSubmit(async ({ phone }) => {
    setError('');
    try {
      const sent = await requestCode(phone);
      router.push({ pathname: '/verify', params: { phone, sentTo: sent.sentTo, devCode: sent.devCode ?? '' } });
    } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Screen title="">
      <Mark size={44} color="brand" />
      <View className="gap-1"><T v="h1">Sign in or create an account</T><T className="text-ink-muted">Save trips, share tips and start your travel wallet. We&apos;ll text you a code.</T></View>
      <View className="gap-1.5">
        <T v="label">Phone number</T>
        <View className="flex-row items-start gap-2">
          <View className="h-[52px] justify-center rounded-xl border-[1.5px] border-control-border px-3"><Text className="font-pop-md text-[15px] text-ink">NG +234</Text></View>
          <View className="flex-1"><FormInput control={control} name="phone" accessibilityLabel="Phone number" placeholder="803 123 4821" keyboardType="phone-pad" autoComplete="tel" onSubmitEditing={() => submit()} /></View>
        </View>
      </View>
      {!!error && <Note tone="danger">{error}</Note>}
      <Button label={isSubmitting ? 'SENDING…' : 'CONTINUE'} disabled={isSubmitting} onPress={() => submit()} />
      <View className="flex-row items-center gap-3"><View className="h-px flex-1 bg-line" /><T v="small">or</T><View className="h-px flex-1 bg-line" /></View>
      <Button variant="outline" label="Continue with Google" onPress={() => setSoon('Google')} />
      <Button variant="outline" label="Continue with Apple" onPress={() => setSoon('Apple')} />
      {!!soon && <Note>{`${soon} sign-in is not available yet. Use your phone number for now.`}</Note>}
      <T v="small" className="text-center text-xs">By continuing you agree to our Terms and Privacy policy.</T>
    </Screen>
  );
}
