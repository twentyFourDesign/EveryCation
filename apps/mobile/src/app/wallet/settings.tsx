import { router } from 'expo-router';
import { Landmark, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { formatNaira, sample } from '@everycation/shared';
import { Button, ListRow, Note, Screen, SectionTitle, T, Toggle } from '@/ui';
import { useApp } from '@/lib/store';

export default function WalletSettings() {
  const { frozen, setFrozen, goals } = useApp();
  const [bio, setBio] = useState(true);
  const w = sample.wallet; const auto = goals.filter((g) => g.autoSave);
  return (
    <Screen title="Wallet settings">
      <Note icon={ShieldCheck}>{`Identity verified. Confirmed with ${w.kycMethod} · Tier [tier]`}</Note>
      <View><View className="flex-row items-end justify-between"><SectionTitle>Linked bank accounts</SectionTitle><Button small variant="ghost" label="+ Add" onPress={() => router.push('/wallet/setup/bank')} /></View>
        {w.banks.map((b) => <ListRow key={b.id} icon={Landmark} title={`${b.bank} •••• ${b.last4}`} subtitle={b.isDefault ? 'Default for withdrawals and auto-save' : b.holder} />)}</View>
      <View><SectionTitle>Security</SectionTitle>
        <ListRow title="Change wallet PIN" onPress={() => router.push('/wallet/setup/pin')} />
        <ListRow title="Approve with face or fingerprint" right={<Toggle label="Approve with face or fingerprint" value={bio} onChange={setBio} />} />
        <ListRow title="Withdrawal limit" subtitle={`${formatNaira(w.dailyLimit)} per day`} /></View>
      <View><SectionTitle>Saving</SectionTitle>
        <ListRow title="Auto-save schedules" subtitle={`${auto.length} active${auto[0] ? ` · ${auto[0].name}` : ''}`} onPress={() => auto[0] && router.push(`/wallet/goal/${auto[0].id}`)} />
        <ListRow title="Freeze wallet" subtitle="Stops all money going out" danger={frozen} right={<Toggle label="Freeze wallet" value={frozen} onChange={setFrozen} />} /></View>
      {frozen && <T v="small" className="text-danger">Your wallet is frozen. Auto-saves still come in, but withdrawals and payments are blocked.</T>}
    </Screen>
  );
}
