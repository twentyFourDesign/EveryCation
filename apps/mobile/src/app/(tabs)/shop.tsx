import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LayoutGrid, Plus, ShoppingBasket } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api, formatNaira } from '@everycation/shared';
import { Button, Chips, Empty, IconButton, Loading, Photo, Screen, T, colors, go } from '@/ui';
import { basketCount, useApp } from '@/lib/store';

const quick: Record<string, string[]> = { All: [], Luggage: ['Luggage & suitcases', 'Backpacks & bags'], 'Tech & power': ['Adapters & power banks', 'eSIMs & data plans'], Toiletries: ['Toiletries & travel-size', 'Skincare & sun care', 'Packing cubes & organisers'] };

export default function Shop() {
  const { data = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: api.products });
  const { basket, addToBasket } = useApp();
  const [cat, setCat] = useState('All');
  const list = data.filter((p) => cat === 'All' || quick[cat]?.includes(p.category));
  return (
    <Screen edges={['top']} title="Travel shop" back={false} right={<IconButton icon={ShoppingBasket} label={`Basket, ${basketCount(basket)} items`} badge={basketCount(basket) || undefined} onPress={() => router.push('/shop/basket')} />}>
      <T className="-mt-3 text-ink-muted">Essentials picked by travellers, delivered before you fly.</T>
      <View className="flex-row items-center gap-2">
        <Button small variant="outline" icon={LayoutGrid} label="Categories" onPress={() => router.push('/shop/categories')} />
        <View className="flex-1"><Chips options={Object.keys(quick)} value={cat} onChange={setCat} /></View>
      </View>
      {isLoading && <Loading what="the shop" />}
      {!isLoading && list.length === 0 && <Empty>Nothing in this category yet.</Empty>}
      <View className="flex-row flex-wrap justify-between gap-y-4">
        {list.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${formatNaira(p.price)}`} onPress={() => go(`/shop/product/${p.id}`)} className="w-[48%] gap-2 active:opacity-80">
            <Photo k={p.image} className="aspect-square rounded-card" />
            <T v="label" numberOfLines={2} className="min-h-9">{p.brand ? `${p.brand} ` : ''}{p.name}</T>
            <View className="flex-row items-center justify-between"><T v="title" className="text-navy">{formatNaira(p.price)}</T>
              <Pressable accessibilityRole="button" accessibilityLabel={`Add ${p.name} to basket`} hitSlop={8} onPress={() => addToBasket(p.id)} className="h-9 w-9 items-center justify-center rounded-full bg-gold"><Plus size={18} color={colors.ink} /></Pressable></View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
