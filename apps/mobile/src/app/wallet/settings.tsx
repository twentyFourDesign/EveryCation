import { router } from 'expo-router';
import { Landmark, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, ListRow, Loading, Note, Screen, SectionTitle, T, Toggle } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useFreeze, useWallet } from '@/lib/wallet';

export default function WalletSettings() {
  const { data: w } = useWallet();
  const freeze = useFreeze();
  const [error, setError] = useState('');
  if (!w) return <Screen title="Wallet settings"><Loading what="your settings" /></Screen>;
  return (
    <Screen title="Wallet settings">
      {w.setup.identity === 'verified' ? <Note icon={ShieldCheck}>Identity verified.</Note> : <Button variant="outline" label="Confirm your identity" onPress={() => router.push('/wallet/setup/identity')} />}
      <View><View className="flex-row items-end justify-between"><SectionTitle>Linked bank accounts</SectionTitle><Button small variant="ghost" label="+ Add" onPress={() => router.push('/wallet/setup/bank')} /></View>
        {w.banks.length === 0 && <T v="small" className="py-3">No bank account linked yet.</T>}
        {w.banks.map((b) => <ListRow key={b.id} icon={Landmark} title={`${b.bankName} •••• ${b.last4}`} subtitle={b.isDefault ? 'Default for withdrawals' : b.accountName} />)}</View>
      <View><SectionTitle>Security</SectionTitle>
        <ListRow title={w.setup.hasPin ? 'Change wallet PIN' : 'Create wallet PIN'} onPress={() => router.push('/wallet/setup/pin')} />
        <ListRow title="Withdrawal limit" subtitle={`${formatNaira(w.dailyWithdrawalLimit)} per day. Larger requests are reviewed first.`} />
        <ListRow title="New bank accounts" subtitle="Withdrawals to a newly added bank are held for 24 hours" />
        <ListRow title="Freeze wallet" subtitle="Stops all money going out" danger={w.frozen} right={<Toggle label="Freeze wallet" value={w.frozen} onChange={(v) => { setError(''); freeze.mutateAsync(v).catch((e) => setError(errorMessage(e))); }} />} /></View>
      {w.frozen && <T v="small" className="text-danger">Your wallet is frozen. Money can still come in, but withdrawals are blocked.</T>}
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
