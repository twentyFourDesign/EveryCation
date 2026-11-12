import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { emailSchema } from '@everycation/shared';
import { Button, FormInput, Mark, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function SignUp() {
  const requestCode = useSession((s) => s.requestCode);
  const { control, handleSubmit, formState: { isSubmitting } } = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });
  const [error, setError] = useState('');
  const [soon, setSoon] = useState('');
  const submit = handleSubmit(async ({ email }) => {
    setError('');
    try {
      const sent = await requestCode(email.trim());
      router.push({ pathname: '/verify', params: { email: email.trim(), sentTo: sent.sentTo, devCode: sent.devCode ?? '' } });
    } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Screen title="">
      <Mark size={44} color="brand" />
      <View className="gap-1"><T v="h1">Sign in or create an account</T><T className="text-ink-muted">Save trips, share tips and start your travel wallet. We&apos;ll email you a code.</T></View>
      <FormInput control={control} name="email" label="Email address" placeholder="ada@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" onSubmitEditing={() => submit()} />
      {!!error && <Note tone="danger">{error}</Note>}
      <Button label={isSubmitting ? 'SENDING…' : 'CONTINUE'} disabled={isSubmitting} onPress={() => submit()} />
      <View className="flex-row items-center gap-3"><View className="h-px flex-1 bg-line" /><T v="small">or</T><View className="h-px flex-1 bg-line" /></View>
      <Button variant="outline" label="Continue with Google" onPress={() => setSoon('Google')} />
      <Button variant="outline" label="Continue with Apple" onPress={() => setSoon('Apple')} />
      {!!soon && <Note>{`${soon} sign-in is not available yet. Use your email address for now.`}</Note>}
      <T v="small" className="text-center text-xs">By continuing you agree to our Terms and Privacy policy.</T>
    </Screen>
  );
}
