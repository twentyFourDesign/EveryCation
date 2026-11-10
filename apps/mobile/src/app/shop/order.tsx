import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { api } from '@everycation/shared';
import { Button, Loading, Photo, Screen, T, cx } from '@/ui';

export default function OrderTracking() {
  const { data: o } = useQuery({ queryKey: ['order'], queryFn: api.order });
  if (!o) return <Loading what="your order" />;
  return (
    <Screen title="Your order" footer={<><Button label="Keep shopping" onPress={() => router.dismissTo('/shop')} /><Button variant="ghost" label="Get help" /></>}>
      <View className="gap-1 rounded-card bg-navy p-5"><Text className="font-pop-sb text-[11px] tracking-widest text-gold">{o.status}</Text><Text className="font-pop-sb text-2xl text-white">Arrives {o.arrives}</Text>
        <Text className="font-pop text-[13px] text-navy-text-soft">Order [ref] · {o.items} items · added to your travel calendar</Text></View>
      <View>
        {o.steps.map((s, i) => (
          <View key={s.title} className="flex-row gap-3">
            <View className="items-center"><View className={cx('h-7 w-7 items-center justify-center rounded-full', s.done ? 'bg-navy' : s.current ? 'border-2 border-navy bg-gold' : 'border-2 border-line bg-white')}>{s.done && <Check size={14} color="#fff" strokeWidth={3} />}</View>
              {i < o.steps.length - 1 && <View className={cx('w-0.5 flex-1', s.done ? 'bg-navy' : 'bg-line')} style={{ minHeight: 28 }} />}</View>
            <View className="flex-1 pb-4"><T v="strong" className={cx(!s.done && !s.current && 'text-ink-muted')}>{s.title}</T>{!!s.detail && <T v="small">{s.detail}</T>}</View>
          </View>
        ))}
      </View>
      <T v="title">In this order</T>
      <View className="flex-row gap-3"><Photo k="product-3" className="h-20 w-20 rounded-2xl" /><Photo k="product-2" className="h-20 w-20 rounded-2xl" /></View>
    </Screen>
  );
}
