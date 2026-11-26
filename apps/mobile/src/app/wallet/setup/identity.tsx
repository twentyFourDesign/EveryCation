import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { identitySchema } from '@everycation/shared';
import { Button, FormInput, Note, Screen, Segmented, T } from '@/ui';
import { DateField, todayIso } from '@/ui/date-field';
import { errorMessage } from '@/lib/api';
import { useVerifyIdentity } from '@/lib/wallet';

type Form = z.infer<typeof identitySchema>;
/** Wallet holders must be 18 or over. */
const adultBy = `${Number(todayIso().slice(0, 4)) - 18}${todayIso().slice(4)}`;
export default function IdentityCheck() {
  const verify = useVerifyIdentity();
  const [error, setError] = useState('');
  const { control, handleSubmit, setValue } = useForm<Form>({ resolver: zodResolver(identitySchema), defaultValues: { method: 'BVN', number: '', dob: '' } });
  const method = useWatch({ control, name: 'method' });
  const submit = handleSubmit(async (v) => {
    setError('');
    const [dd, mm, yyyy] = v.dob.split('/');
    try { await verify.mutateAsync({ method: v.method, number: v.number, dateOfBirth: `${yyyy}-${mm}-${dd}` }); router.replace('/wallet/setup/pin'); }
    catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Screen title="Step 1 of 3" footer={<Button disabled={verify.isPending} label={verify.isPending ? 'CHECKING…' : 'CONFIRM'} onPress={() => submit()} />}>
      <View className="gap-1"><T v="h1">Confirm it&apos;s you</T><T className="text-ink-muted">Before your wallet can hold money, we need to check your identity. It takes about a minute.</T></View>
      <Segmented options={['BVN', 'NIN'] as const} value={method} onChange={(m) => setValue('method', m)} />
      <FormInput control={control} name="number" label={method === 'BVN' ? 'Bank Verification Number *' : 'National Identification Number *'} placeholder="11 digits" keyboardType="number-pad" maxLength={11} hint={method === 'BVN' ? 'Dial *565*0# on your registered line to get it.' : 'Dial *346# on your registered line to get it.'} />
      <Controller control={control} name="dob" render={({ field, fieldState }) => (
        <DateField label="Date of birth *" value={field.value ? field.value.split('/').reverse().join('-') : ''} onChange={(d) => field.onChange(d.split('-').reverse().join('/'))} max={adultBy} placeholder="Choose your date of birth" error={fieldState.error?.message} />
      )} />
      {!!error && <Note tone="danger">{error}</Note>}
      <Note icon={Info}>We only use this to confirm your name and date of birth. It doesn&apos;t give us access to your bank account, and we don&apos;t keep the number.</Note>
    </Screen>
  );
}
