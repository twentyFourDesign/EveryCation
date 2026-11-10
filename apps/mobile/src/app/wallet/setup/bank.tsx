import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { bankSchema, sample } from '@everycation/shared';
import { Button, Chips, FormInput, Screen, T } from '@/ui';
import { useApp } from '@/lib/store';

type Form = z.infer<typeof bankSchema>;
export default function LinkBank() {
  const { walletReady, finishWalletSetup } = useApp();
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(bankSchema), defaultValues: { bank: 'GTBank', accountNumber: '' } });
  const resolved = /^\d{10}$/.test(useWatch({ control, name: 'accountNumber' }));
  const done = handleSubmit(() => { finishWalletSetup(); router.dismissTo('/wallet'); });
  return (
    <Screen title={walletReady ? 'Add a bank account' : 'Step 3 of 3'} footer={<Button label={walletReady ? 'ADD ACCOUNT' : 'FINISH SETUP'} onPress={done} />}>
      <View className="gap-1"><T v="h1">Link your bank account</T><T className="text-ink-muted">Withdrawals go here, and auto-saves can come from here. It must be in your own name.</T></View>
      <View className="gap-2"><T v="label">Bank *</T><Controller control={control} name="bank" render={({ field }) => <Chips wrap options={sample.nigerianBanks} value={field.value} onChange={field.onChange} />} />{errors.bank && <T v="small" className="text-danger">{errors.bank.message}</T>}</View>
      <FormInput control={control} name="accountNumber" label="Account number *" placeholder="10 digits" keyboardType="number-pad" maxLength={10} />
      {resolved && <View className="flex-row items-center gap-3 rounded-2xl bg-tint p-3.5"><BadgeCheck size={22} color="#002C82" /><View><T v="small" className="text-xs">Account name</T><T v="strong">OLUWOLE OLAREWAJU</T></View></View>}
      <T v="small">{resolved ? 'The name matches your verified identity. ' : ''}You can add more accounts later in Wallet settings.</T>
    </Screen>
  );
}
