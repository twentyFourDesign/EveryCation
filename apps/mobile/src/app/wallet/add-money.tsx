import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { addMoneySchema, formatNaira, parseNaira } from '@everycation/shared';
import { Button, Chips, Input, Loading, Note, Option, Screen, T } from '@/ui';
import { DEV_TOOLS, errorMessage } from '@/lib/api';
import { useDevDeposit, useMoveGoal, useWallet } from '@/lib/wallet';

const quick = ['₦25,000', '₦100,000', '₦250,000'];

export default function AddMoney() {
  const p = useLocalSearchParams<{ to?: string }>();
  const { data: w } = useWallet();
  const deposit = useDevDeposit(); const move = useMoveGoal();
  const [amount, setAmount] = useState('₦100,000');
  const [destination, setDestination] = useState(p.to ?? 'available');
  const [method, setMethod] = useState<'transfer' | 'card' | 'balance'>('transfer');
  const [error, setError] = useState('');
  const [key] = useState(() => randomUUID());
  if (!w) return <Screen title="Add money"><Loading what="your wallet" /></Screen>;

  const check = addMoneySchema.safeParse({ amount, destination, method: method === 'balance' ? 'transfer' : method });
  const kobo = parseNaira(amount) ?? 0;
  const toGoal = destination !== 'available';
  const fromBalance = method === 'balance' && toGoal;
  const amountError = !check.success ? check.error.issues.find((i) => i.path[0] === 'amount')?.message : fromBalance && kobo > w.available ? `Your available balance is ${formatNaira(w.available)}` : undefined;
  const busy = deposit.isPending || move.isPending;

  async function run(action: () => Promise<unknown>) { setError(''); try { await action(); router.back(); } catch (e) { setError(errorMessage(e)); } }
  const moveNow = () => run(() => move.mutateAsync({ goalId: destination, amount: kobo, direction: 'in', key }));
  const testDeposit = () => run(() => deposit.mutateAsync({ amount: kobo, goalId: toGoal ? destination : undefined, channel: method === 'card' ? 'card' : 'transfer' }));

  return (
    <Screen title="Add money" footer={fromBalance
      ? <Button disabled={!!amountError || busy} label={busy ? 'MOVING…' : `MOVE ${formatNaira(kobo)}`} onPress={moveNow} />
      : <Button label="DONE" variant="outline" onPress={() => router.back()} />}>
      <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={amountError} />
      <Chips wrap options={quick} value={amount} onChange={setAmount} />
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Put it in</T>
        <Option title="Available balance" on={destination === 'available'} onPress={() => { setDestination('available'); if (method === 'balance') setMethod('transfer'); }} right={formatNaira(w.available)} />
        {w.goals.map((g) => <Option key={g.id} title={`${g.name} goal`} on={destination === g.id} onPress={() => setDestination(g.id)} right={formatNaira(g.saved)} />)}
      </View>
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Pay with</T>
        {toGoal && <Option title="Available balance" sub={`${formatNaira(w.available)} in your wallet now`} on={method === 'balance'} onPress={() => setMethod('balance')} />}
        <Option title="Bank transfer" sub="To your EveryCation account number" on={method === 'transfer'} onPress={() => setMethod('transfer')} />
        <Option title="Debit card" sub="Pay with any Nigerian card" on={method === 'card'} onPress={() => setMethod('card')} />
      </View>
      {method === 'transfer' && <Note>Your personal EveryCation account number will show here once our bank partner is connected. Money lands in the place you picked as soon as your bank sends it.</Note>}
      {method === 'card' && <Note>Card payments open here once our payments partner is connected.</Note>}
      {!!error && <Note tone="danger">{error}</Note>}
      {DEV_TOOLS && !fromBalance && (
        <View className="gap-2 rounded-card border-[1.5px] border-dashed border-control-border p-3.5">
          <T v="small">Test server only: act as the bank and confirm this {method === 'card' ? 'card payment' : 'transfer'}.</T>
          <Button small variant="navy" icon={FlaskConical} disabled={!!amountError || busy} label={busy ? 'Adding…' : `Add ${formatNaira(kobo)} test money`} onPress={testDeposit} />
        </View>
      )}
    </Screen>
  );
}
