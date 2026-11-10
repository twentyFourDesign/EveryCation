import { router } from 'expo-router';
import { View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Badge, Button, Card, Empty, Loading, Screen, T, go } from '@/ui';
import { useSession } from '@/lib/session';
import { useOrders } from '@/lib/shop';

const label = { placed: 'Placed', packed: 'Packed', shipped: 'On its way', delivered: 'Delivered', cancelled: 'Cancelled' };

export default function Orders() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { data, isLoading } = useOrders();
  if (!signedIn) return <Screen title="My orders"><View className="gap-4 pt-10"><T className="text-center text-ink-muted">Sign in to see your orders.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></View></Screen>;
  return (
    <Screen title="My orders">
      {isLoading && <Loading what="your orders" />}
      {data?.length === 0 && <Empty>No orders yet.</Empty>}
      {data?.map((o) => (
        <Card key={o.id} onPress={() => go(`/shop/order/${o.id}`)} label={`Order ${o.reference}, ${label[o.status]}`} className="gap-1.5">
          <View className="flex-row items-center justify-between"><T v="strong">{o.reference}</T><Badge label={label[o.status]} tone={o.status === 'cancelled' ? 'danger' : o.status === 'delivered' ? 'info' : 'gold'} /></View>
          <T v="small">{o.items.map((i) => i.name).join(', ')}</T><T v="label">{formatNaira(o.total)}</T>
        </Card>
      ))}
    </Screen>
  );
}
