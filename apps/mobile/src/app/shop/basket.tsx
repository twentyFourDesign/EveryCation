import { router } from 'expo-router';
import { Minus, PiggyBank, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, KeyValue, Note, Screen, T, colors } from '@/ui';
import { ProductPhoto } from '@/ui/product-photo';
import { useBasket } from '@/lib/shop';
import { useApp } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

export default function Basket() {
  const { lines, subtotal, count } = useBasket();
  const setQty = useApp((s) => s.setQty);
  const shopping = useWallet().data?.goals.find((g) => g.kind === 'shopping' && g.saved > 0);
  const Step = ({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} className="h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-control-border"><Icon size={16} color={colors.ink} /></Pressable>);
  if (count === 0) return <Screen title="Basket"><View className="items-center gap-4 pt-16"><T v="h2">Your basket is empty</T><T className="text-center text-ink-muted">Add travel essentials and we&apos;ll deliver them before you fly.</T><Button label="GO TO THE SHOP" onPress={() => router.dismissTo('/shop')} /></View></Screen>;
  return (
    <Screen title={`Basket · ${count} item${count > 1 ? 's' : ''}`} footer={<Button label={`CHECKOUT · ${formatNaira(subtotal)}`} onPress={() => router.push('/shop/checkout')} />}>
      {lines.map(({ p, qty }) => (
        <View key={p.id} className="flex-row gap-3 rounded-card bg-surface-muted p-3">
          <ProductPhoto p={p} className="h-20 w-20 rounded-2xl" />
          <View className="flex-1 justify-between"><View><T v="strong" numberOfLines={1}>{p.name}</T>{!!p.variant && <T v="small">{p.variant}</T>}</View>
            <View className="flex-row items-center justify-between"><T v="title" className="text-navy">{formatNaira(p.price * qty)}</T>
              <View className="flex-row items-center gap-3"><Step icon={Minus} label={qty === 1 ? `Remove ${p.name}` : 'One fewer'} onPress={() => setQty(p.id, qty - 1)} /><T v="strong" accessibilityLabel={`Quantity ${qty}`}>{qty}</T><Step icon={Plus} label="One more" onPress={() => setQty(p.id, qty + 1)} /></View></View></View>
        </View>
      ))}
      {shopping && <Note icon={PiggyBank}>{`Your ${shopping.name} goal (${formatNaira(shopping.saved)}) can pay for this at checkout.`}</Note>}
      <View><KeyValue k="Subtotal" v={formatNaira(subtotal)} /><KeyValue k="Delivery" v="At checkout" /></View>
    </Screen>
  );
}
