import { router } from 'expo-router';
import { Home } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira, sample } from '@everycation/shared';
import { Button, KeyValue, Note, Option, Screen, T, colors } from '@/ui';
import { useApp } from '@/lib/store';
import { useBasket } from './basket';

export default function ShopCheckout() {
  const { subtotal, count } = useBasket();
  const { goals, payFromGoal, clearBasket, frozen } = useApp();
  const goal = goals.find((g) => g.kind === 'shopping' && !g.locked && g.saved > 0);
  const [delivery, setDelivery] = useState<'standard' | 'express'>('standard');
  const [pay, setPay] = useState<'goal' | 'card'>(goal ? 'goal' : 'card');
  const fromGoal = pay === 'goal' && goal && !frozen ? Math.min(goal.saved, subtotal) : 0;
  function place() {
    if (fromGoal && goal) payFromGoal(goal.id, fromGoal, `Shop order · ${count} item${count > 1 ? 's' : ''}`);
    clearBasket(); router.dismissTo('/shop'); router.push('/shop/order');
  }
  return (
    <Screen title="Checkout" footer={<Button disabled={count === 0} label="PLACE ORDER" onPress={place} />}>
      <View className="gap-2"><View className="flex-row items-center justify-between"><T v="label">Deliver to</T><Text accessibilityRole="link" className="font-pop-sb text-[13px] text-heading-blue">Change</Text></View>
        <View className="flex-row gap-3 rounded-2xl border-[1.5px] border-line p-3.5"><Home size={20} color={colors.navy} /><View className="flex-1"><T v="strong">Home</T><T v="small">[street address], Lekki Phase 1, Lagos{'\n'}+234 803 ••• 4821</T></View></View></View>
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Delivery</T>
        <Option title="Standard" sub="Arrives by Wed 9 Dec, before your trip" right="[fee]" on={delivery === 'standard'} onPress={() => setDelivery('standard')} />
        <Option title="Express" sub="Arrives in 1–2 working days" right="[fee]" on={delivery === 'express'} onPress={() => setDelivery('express')} /></View>
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Pay with</T>
        {goal && <Option title={`${goal.name} goal`} sub={`${formatNaira(goal.saved)} available${goal.saved < subtotal ? ` · ${sample.wallet.card} pays the rest` : ''}`} on={pay === 'goal'} onPress={() => setPay('goal')} />}
        <Option title={`Debit card · ${sample.wallet.card}`} on={pay === 'card'} onPress={() => setPay('card')} /></View>
      {frozen && pay === 'goal' && <Note tone="danger">Your wallet is frozen, so this order will be charged to your card.</Note>}
      <View className="rounded-card bg-surface-muted px-4 py-2"><KeyValue k="Total" v={`${formatNaira(subtotal)} + delivery`} strong />
        {fromGoal > 0 && <T v="small" className="pb-2 text-right">{formatNaira(fromGoal)} from your goal{fromGoal < subtotal ? ' · rest by card' : ''}</T>}</View>
    </Screen>
  );
}
