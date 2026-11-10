import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { identitySchema } from '@everycation/shared';
import { Button, FormInput, Note, Screen, Segmented, T } from '@/ui';

type Form = z.infer<typeof identitySchema>;
export default function IdentityCheck() {
  const { control, handleSubmit, setValue } = useForm<Form>({ resolver: zodResolver(identitySchema), defaultValues: { method: 'BVN', number: '', dob: '' } });
  const method = useWatch({ control, name: 'method' });
  return (
    <Screen title="Step 1 of 3" footer={<Button label="CONFIRM" onPress={handleSubmit(() => router.push('/wallet/setup/pin'))} />}>
      <View className="gap-1"><T v="h1">Confirm it&apos;s you</T><T className="text-ink-muted">Before your wallet can hold money, we need to check your identity. It takes about a minute.</T></View>
      <Segmented options={['BVN', 'NIN'] as const} value={method} onChange={(m) => setValue('method', m)} />
      <FormInput control={control} name="number" label={method === 'BVN' ? 'Bank Verification Number *' : 'National Identification Number *'} placeholder="11 digits" keyboardType="number-pad" maxLength={11} hint={method === 'BVN' ? 'Dial *565*0# on your registered line to get it.' : 'Dial *346# on your registered line to get it.'} />
      <FormInput control={control} name="dob" label="Date of birth *" placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" maxLength={10} />
      <Note icon={Info}>We only use this to confirm your name and date of birth. It doesn&apos;t give us access to your bank account.</Note>
    </Screen>
  );
}
