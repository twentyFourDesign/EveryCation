import { router, useLocalSearchParams } from 'expo-router';
import { LayoutGrid, Plus, ShoppingBasket } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, Empty, IconButton, Loading, Note, Screen, SearchBar, T, colors, go } from '@/ui';
import { ProductPhoto } from '@/ui/product-photo';
import { errorMessage } from '@/lib/api';
import { useBasket, useProducts } from '@/lib/shop';
import { useApp } from '@/lib/store';

export default function Shop() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [term, setTerm] = useState(''); const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(term.trim()), 250); return () => clearTimeout(t); }, [term]);
  const { data, isLoading, error } = useProducts(category, q);
  const { count } = useBasket();
  const addToBasket = useApp((s) => s.addToBasket);
  return (
    <Screen edges={['top']} title="Travel shop" back={false} right={<IconButton icon={ShoppingBasket} label={`Basket, ${count} items`} badge={count || undefined} onPress={() => router.push('/shop/basket')} />}>
      <T className="-mt-3 text-ink-muted">Essentials picked by travellers, delivered before you fly.</T>
      <SearchBar value={term} onChangeText={setTerm} placeholder="Search travel essentials" />
      <View className="flex-row flex-wrap items-center gap-2">
        <Button small variant="outline" icon={LayoutGrid} label="Categories" onPress={() => router.push('/shop/categories')} />
        <Button small variant="outline" label="My orders" onPress={() => router.push('/shop/orders')} />
        {category && <Pressable accessibilityRole="button" accessibilityLabel={`Showing ${category}. Show everything`} onPress={() => router.setParams({ category: undefined })} className="h-10 justify-center rounded-full bg-navy px-4"><Text className="font-pop-md text-[13px] text-white">{category} ✕</Text></Pressable>}
      </View>
      {isLoading && <Loading what="the shop" />}
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {data?.length === 0 && <Empty>{q || category ? 'Nothing matches. Try another word or category.' : 'The shop is being stocked. Check back soon.'}</Empty>}
      <View className="flex-row flex-wrap justify-between gap-y-4">
        {data?.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${formatNaira(p.price)}${p.inStock ? '' : ', sold out'}`} onPress={() => go(`/shop/product/${p.id}`)} className="w-[48%] gap-2 active:opacity-80">
            <ProductPhoto p={p} className="aspect-square rounded-card" />
            <T v="label" numberOfLines={2} className="min-h-9">{p.brand ? `${p.brand} ` : ''}{p.name}</T>
            <View className="flex-row items-center justify-between"><T v="title" className="text-navy">{formatNaira(p.price)}</T>
              {p.inStock ? <Pressable accessibilityRole="button" accessibilityLabel={`Add ${p.name} to basket`} hitSlop={8} onPress={() => addToBasket(p.id)} className="h-9 w-9 items-center justify-center rounded-full bg-gold"><Plus size={18} color={colors.ink} /></Pressable> : <T v="small" className="text-xs text-danger">Sold out</T>}</View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
