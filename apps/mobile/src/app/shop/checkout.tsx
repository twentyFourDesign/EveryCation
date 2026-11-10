import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, Input, KeyValue, Loading, Note, Option, PinPad, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useBasket, useDelivery, usePlaceOrder } from '@/lib/shop';
import { useApp } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

export default function ShopCheckout() {
  const { lines, subtotal, count, allDigital } = useBasket();
  const clearBasket = useApp((s) => s.clearBasket);
  const { status, me } = useSession();
  const { data: wallet, isLoading } = useWallet();
  const { data: options = [] } = useDelivery();
  const place = usePlaceOrder();
  const [delivery, setDelivery] = useState<'standard' | 'express'>('standard'); const [address, setAddress] = useState(''); const [phone, setPhone] = useState(me?.phone ?? '');
  const [goalId, setGoalId] = useState<string | null | undefined>(undefined); const [tried, setTried] = useState(false); const [paying, setPaying] = useState(false); const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [key] = useState(() => randomUUID());
  if (status !== 'signedIn') return <Screen title="Checkout"><View className="gap-4 pt-10"><T className="text-center text-ink-muted">Sign in to order. You pay from your travel wallet.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View></Screen>;
  if (isLoading || !wallet) return <Screen title="Checkout"><Loading what="your wallet" /></Screen>;
  if (!wallet.setup.ready) return <Screen title="Checkout"><View className="gap-4 pt-10"><T className="text-center text-ink-muted">Orders are paid from your travel wallet. Set it up first; it takes about three minutes.</T><Button label="SET UP WALLET" onPress={() => router.push('/wallet')} /></View></Screen>;

  const goals = wallet.goals.filter((g) => !g.locked && g.saved > 0);
  const chosen = goalId === undefined ? (goals.find((g) => g.kind === 'shopping') ?? null) : goals.find((g) => g.id === goalId) ?? null;
  const fee = allDigital ? 0 : (options.find((o) => o.id === delivery)?.fee ?? 0); const total = subtotal + fee;
  const fromGoal = chosen ? Math.min(chosen.saved, total) : 0; const fromBalance = total - fromGoal;
  const errors = { address: !allDigital && address.trim().length < 10 ? 'Enter the full delivery address' : undefined, phone: phone.trim().length < 7 ? 'Enter a phone number for the courier' : undefined };
  const short = fromBalance > wallet.available ? `You need ${formatNaira(fromBalance - wallet.available)} more in your available balance.` : wallet.frozen ? 'Your wallet is frozen. Unfreeze it in Wallet settings first.' : undefined;

  async function pay(value: string) {
    setError('');
    try {
      const order = await place.mutateAsync({ items: lines.map((l) => ({ productId: l.p.id, qty: l.qty })), delivery, address: allDigital ? 'Digital delivery by email' : address.trim(), phone: phone.trim(), goalId: chosen?.id, pin: value, key });
      clearBasket(); router.dismissTo('/shop'); router.push(`/shop/order/${order.id}`);
    } catch (e) { setPin(''); setError(errorMessage(e)); }
  }
  if (paying) return (
    <Screen title="" scroll={false} className="items-center justify-between">
      <View className="items-center gap-2"><T v="h2" className="text-center">Pay {formatNaira(total)}</T><T v="small" className="text-center">{fromGoal > 0 ? `${formatNaira(fromGoal)} from ${chosen!.name}${fromBalance > 0 ? `, ${formatNaira(fromBalance)} from your balance` : ''}` : 'From your available balance'}</T></View>
      <View className="items-center gap-4"><T v="strong">{place.isPending ? 'Placing your order…' : 'Enter your wallet PIN'}</T>
        {!!error && <Text accessibilityRole="alert" className="text-center font-pop-md text-[13px] text-danger">{error}</Text>}
        <PinPad value={pin} onChange={(v) => { if (place.isPending) return; setPin(v); if (v.length === 4) pay(v); }} /></View>
      <Button variant="ghost" label="Back to checkout" onPress={() => { setPaying(false); setPin(''); setError(''); }} />
    </Screen>
  );
  return (
    <Screen title="Checkout" footer={<Button disabled={count === 0 || !!short} label={`PAY ${formatNaira(total)}`} onPress={() => { setTried(true); if (!errors.address && !errors.phone) setPaying(true); }} />}>
      {!allDigital && <Input label="Delivery address *" value={address} onChangeText={setAddress} multiline maxLength={300} placeholder="House number, street, area, city" autoComplete="street-address" error={tried ? errors.address : undefined} />}
      <Input label="Phone for the courier *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} error={tried ? errors.phone : undefined} />
      {allDigital ? <Note>Everything in this order is digital and arrives by email. No delivery fee.</Note> : (
        <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Delivery</T>
          {options.map((o) => <Option key={o.id} title={o.label} sub={o.eta} right={formatNaira(o.fee)} on={delivery === o.id} onPress={() => setDelivery(o.id)} />)}</View>
      )}
      <View accessibilityRole="radiogroup" className="gap-2"><T v="label">Pay with</T>
        {goals.map((g) => <Option key={g.id} title={`${g.name} goal`} sub={`${formatNaira(g.saved)} saved${g.saved < total ? ' · your balance pays the rest' : ''}`} on={chosen?.id === g.id} onPress={() => setGoalId(g.id)} />)}
        <Option title="Available balance" sub={`${formatNaira(wallet.available)} in your wallet`} on={!chosen} onPress={() => setGoalId(null)} /></View>
      {!!short && <><Note tone="danger">{short}</Note><Button variant="outline" label="Add money" onPress={() => router.push('/wallet/add-money')} /></>}
      <View className="rounded-card bg-surface-muted px-4 py-2"><KeyValue k="Items" v={formatNaira(subtotal)} /><KeyValue k="Delivery" v={fee ? formatNaira(fee) : 'Free'} /><KeyValue k="Total" v={formatNaira(total)} strong /></View>
    </Screen>
  );
}
