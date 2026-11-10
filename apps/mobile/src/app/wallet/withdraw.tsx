import { router } from 'expo-router';
import { Landmark, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira, parseNaira, sample } from '@everycation/shared';
import { Button, Chips, Input, KeyValue, Note, Option, Screen, T, colors, go } from '@/ui';
import { useApp } from '@/lib/store';

export default function Withdraw() {
  const { available, goals, frozen } = useApp();
  const [amount, setAmount] = useState('₦50,000');
  const [source, setSource] = useState('available');
  const bank = sample.wallet.banks[0]!;
  const max = source === 'available' ? available : (goals.find((g) => g.id === source)?.saved ?? 0);
  const kobo = parseNaira(amount) ?? 0;
  const error = frozen ? 'Your wallet is frozen. Unfreeze it in Wallet settings first.'
    : kobo < 100000 ? 'Enter an amount of at least ₦1,000'
    : kobo > max ? `You can withdraw up to ${formatNaira(max)} from here`
    : kobo > sample.wallet.dailyLimit ? `Your daily limit is ${formatNaira(sample.wallet.dailyLimit)}` : undefined;
  const quick = ['₦20,000', '₦50,000', `All ${formatNaira(max)}`];
  return (
    <Screen title="Withdraw" footer={<><Button disabled={!!error} label={`WITHDRAW ${formatNaira(kobo)}`} onPress={() => router.push({ pathname: '/wallet/withdraw-pin', params: { amount: String(kobo), source } })} /><T v="small" className="text-center text-xs">You&apos;ll confirm with your wallet PIN</T></>}>
      <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={error} />
      <Chips wrap options={quick} value={amount} onChange={(v) => setAmount(v.replace('All ', ''))} />
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">From</T>
        <Option title="Available balance" on={source === 'available'} onPress={() => setSource('available')} right={formatNaira(available)} />
        {goals.map((g) => g.locked ? (
          <View key={g.id} className="min-h-[60px] flex-row items-center gap-3 rounded-2xl border-[1.5px] border-line bg-surface-muted px-4 py-2.5">
            <Lock size={18} color={colors.inkMuted} />
            <View className="flex-1"><Text className="font-pop-md text-[15px] text-ink-muted">{g.name} goal</Text><Text className="font-pop text-xs text-ink-muted">Locked until {g.by?.replace(' 2026', '')} · <Text accessibilityRole="link" onPress={() => go(`/wallet/goal/${g.id}`)} className="font-pop-sb text-heading-blue">Unlock</Text></Text></View>
            <Text className="font-pop-sb text-sm text-ink-muted">{formatNaira(g.saved)}</Text>
          </View>
        ) : <Option key={g.id} title={`${g.name} goal`} on={source === g.id} onPress={() => setSource(g.id)} right={formatNaira(g.saved)} />)}
      </View>
      <View className="gap-2"><T v="label">To</T>
        <View className="flex-row items-center gap-3 rounded-2xl border-[1.5px] border-line p-3.5"><View className="h-10 w-10 items-center justify-center rounded-full bg-tint"><Landmark size={20} color={colors.navy} /></View>
          <View className="flex-1"><T v="strong">{bank.bank} •••• {bank.last4}</T><T v="small">{bank.holder} · verified</T></View>
          <Text accessibilityRole="link" onPress={() => router.push('/wallet/settings')} className="font-pop-sb text-[13px] text-heading-blue">Change</Text></View>
      </View>
      <View><KeyValue k="Transfer fee" v="[fee]" /><KeyValue k="Arrives" v="[timing]" /></View>
      {kobo > sample.wallet.dailyLimit / 2 && !error && <Note>Large withdrawals can be held briefly for a security check.</Note>}
    </Screen>
  );
}
