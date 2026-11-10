import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { bankSchema, sample } from '@everycation/shared';
import { Button, Chips, FormInput, Loading, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useAddBank, useWallet } from '@/lib/wallet';

type Form = z.infer<typeof bankSchema>;
export default function LinkBank() {
  const { data: w } = useWallet();
  const addBank = useAddBank();
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<Form>({ resolver: zodResolver(bankSchema), defaultValues: { bank: 'GTBank', accountNumber: '' } });
  if (!w) return <Screen title=""><Loading what="your wallet" /></Screen>;
  const adding = w.setup.hasBank;
  const submit = handleSubmit(async (v) => {
    setError('');
    try { await addBank.mutateAsync({ bankName: v.bank, accountNumber: v.accountNumber }); router.dismissTo('/wallet'); }
    catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Screen title={adding ? 'Add a bank account' : 'Step 3 of 3'} footer={<Button disabled={addBank.isPending} label={addBank.isPending ? 'CHECKING…' : adding ? 'ADD ACCOUNT' : 'FINISH SETUP'} onPress={() => submit()} />}>
      <View className="gap-1"><T v="h1">Link your bank account</T><T className="text-ink-muted">Withdrawals go here. It must be in your own name; we check the name with your bank.</T></View>
      <View className="gap-2"><T v="label">Bank *</T><Controller control={control} name="bank" render={({ field }) => <Chips wrap options={sample.nigerianBanks} value={field.value} onChange={field.onChange} />} /></View>
      <FormInput control={control} name="accountNumber" label="Account number *" placeholder="10 digits" keyboardType="number-pad" maxLength={10} />
      {!!error && <Note tone="danger">{error}</Note>}
      <T v="small">{adding ? 'For your safety, withdrawals to a newly added account are held for 24 hours.' : 'You can add more accounts later in Wallet settings.'}</T>
    </Screen>
  );
}
