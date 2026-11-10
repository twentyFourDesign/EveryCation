import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, KeyValue, Loading, Note, Screen, T, cx } from '@/ui';
import { ProductPhoto } from '@/ui/product-photo';
import { errorMessage } from '@/lib/api';
import { useOrder } from '@/lib/shop';

const steps = [['placed', 'Order placed'], ['packed', 'Packed'], ['shipped', 'On its way'], ['delivered', 'Delivered']] as const;
const headline = { placed: 'ORDER PLACED', packed: 'PACKED', shipped: 'ON ITS WAY', delivered: 'DELIVERED', cancelled: 'CANCELLED' };

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: o, isLoading, error } = useOrder(id);
  if (isLoading) return <Screen title="Your order"><Loading what="your order" /></Screen>;
  if (!o) return <Screen title="Your order"><Note tone="danger">{error ? errorMessage(error) : 'This order could not be found.'}</Note></Screen>;
  const at = steps.findIndex(([s]) => s === o.status);
  return (
    <Screen title="Your order" footer={<Button label="Keep shopping" onPress={() => router.dismissTo('/shop')} />}>
      <View className="gap-1 rounded-card bg-navy p-5"><Text className="font-pop-sb text-[11px] tracking-widest text-gold">{headline[o.status]}</Text><Text className="font-pop-sb text-2xl text-white">{o.reference}</Text>
        <Text className="font-pop text-[13px] text-navy-text-soft">{o.items.length} item{o.items.length === 1 ? '' : 's'} · {o.delivery} · placed {new Date(o.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text></View>
      {o.status === 'cancelled' ? <Note tone="danger">{`This order was cancelled. ${formatNaira(o.total)} went back to your available balance.`}</Note> : (
        <View>
          {steps.map(([s, label], i) => { const done = i < at || o.status === 'delivered'; const current = i === at && o.status !== 'delivered'; return (
            <View key={s} className="flex-row gap-3">
              <View className="items-center"><View className={cx('h-7 w-7 items-center justify-center rounded-full', done ? 'bg-navy' : current ? 'border-2 border-navy bg-gold' : 'border-2 border-line bg-white')}>{done && <Check size={14} color="#fff" strokeWidth={3} />}</View>
                {i < steps.length - 1 && <View className={cx('w-0.5 flex-1', done ? 'bg-navy' : 'bg-line')} style={{ minHeight: 26 }} />}</View>
              <View className="flex-1 pb-4"><T v="strong" className={cx(!done && !current && 'text-ink-muted')}>{label}</T></View>
            </View>); })}
        </View>
      )}
      <T v="title">In this order</T>
      {o.items.map((i) => <View key={i.productId} className="flex-row items-center gap-3"><ProductPhoto p={i} className="h-16 w-16 rounded-2xl" /><View className="flex-1"><T v="strong" numberOfLines={1}>{i.name}</T><T v="small">{i.qty} × {formatNaira(i.price)}</T></View></View>)}
      <View className="rounded-card bg-surface-muted px-4 py-2"><KeyValue k="Items" v={formatNaira(o.subtotal)} /><KeyValue k="Delivery" v={o.deliveryFee ? formatNaira(o.deliveryFee) : 'Free'} />
        {o.paidFromGoal > 0 && <KeyValue k={`From ${o.goalName ?? 'your goal'}`} v={formatNaira(o.paidFromGoal)} />}<KeyValue k="Total paid" v={formatNaira(o.total)} strong /></View>
      {!!o.address && o.delivery !== 'Sent by email' && <T v="small">Delivering to: {o.address}</T>}
    </Screen>
  );
}
