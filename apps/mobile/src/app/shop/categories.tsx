import { router } from 'expo-router';
import { Tag } from 'lucide-react-native';
import { View } from 'react-native';
import { Empty, ListRow, Loading, Screen, T } from '@/ui';
import { useCategories } from '@/lib/shop';

export default function ShopCategories() {
  const { data, isLoading } = useCategories();
  return (
    <Screen title="Shop by category">
      {isLoading && <Loading what="categories" />}
      {data?.length === 0 && <Empty>No products yet.</Empty>}
      <View>{data?.map((c) => <ListRow key={c.category} icon={Tag} title={c.category} right={<T v="small">{c.count}</T>} onPress={() => { router.dismissTo('/shop'); router.setParams({ category: c.category }); }} />)}</View>
    </Screen>
  );
}
