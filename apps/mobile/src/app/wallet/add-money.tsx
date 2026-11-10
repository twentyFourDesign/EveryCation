import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { addMoneySchema, formatNaira, parseNaira, sample } from '@everycation/shared';
import { Button, Chips, Input, Note, Option, Screen, T } from '@/ui';
import { useApp } from '@/lib/store';

const quick = ['₦25,000', '₦100,000', '₦250,000'];

export default function AddMoney() {
  const p = useLocalSearchParams<{ to?: string }>();
  const { goals, addMoney } = useApp();
  const [amount, setAmount] = useState('₦100,000');
  const [destination, setDestination] = useState(p.to ?? goals[0]?.id ?? 'available');
  const [method, setMethod] = useState<'transfer' | 'card'>('transfer');
  const [copied, setCopied] = useState(false);
  const check = addMoneySchema.safeParse({ amount, destination, method });
  const done = () => { if (!check.success) return; addMoney(parseNaira(amount)!, destination); router.back(); };
  return (
    <Screen title="Add money" footer={<Button disabled={!check.success} label={method === 'transfer' ? "I'VE SENT THE MONEY" : `PAY ${amount.toUpperCase()}`} onPress={done} />}>
      <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={check.success ? undefined : check.error.issues.find((i) => i.path[0] === 'amount')?.message} />
      <Chips wrap options={quick} value={amount} onChange={setAmount} />
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Put it in</T>
        {goals.map((g) => <Option key={g.id} title={`${g.name} goal`} on={destination === g.id} onPress={() => setDestination(g.id)} right={formatNaira(g.saved)} />)}
        <Option title="Available balance" on={destination === 'available'} onPress={() => setDestination('available')} />
      </View>
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Pay with</T>
        <Option title="Bank transfer" sub="To your EveryCation account number" on={method === 'transfer'} onPress={() => setMethod('transfer')} />
        <Option title="Debit card" sub={sample.wallet.card} on={method === 'card'} onPress={() => setMethod('card')} />
      </View>
      {method === 'transfer' && (
        <View className="gap-2 rounded-card bg-surface-muted p-4">
          <T v="eyebrow" className="text-ink-muted">TRANSFER TO</T>
          <View className="flex-row items-center justify-between"><View><T v="h2">[account no.]</T><T v="small">[partner bank] · EveryCation / Oluwole O.</T></View>
            <Button small variant="outline" label={copied ? 'Copied' : 'Copy'} onPress={async () => { await Clipboard.setStringAsync('[account no.]'); setCopied(true); }} /></View>
        </View>
      )}
      <Note>{method === 'transfer' ? 'Money lands in the place you picked as soon as your bank sends it.' : 'Your card is charged now and the money shows up straight away.'}</Note>
    </Screen>
  );
}
