import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Share2, ShoppingBasket, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, formatNaira } from '@everycation/shared';
import { Button, IconButton, Loading, Note, Photo, T } from '@/ui';
import { basketCount, useApp } from '@/lib/store';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p } = useQuery({ queryKey: ['product', id], queryFn: () => api.product(id) });
  const { basket, addToBasket } = useApp();
  const [added, setAdded] = useState(false);
  if (!p) return <Loading what="this product" />;
  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}><View className="w-full max-w-[520px] self-center">
        <Photo k={p.image} className="h-[360px]" alt={p.name} />
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0"><View className="flex-row gap-2 px-4 pt-2">
          <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/shop'))} /><View className="flex-1" />
          <IconButton tone="glass" icon={Share2} label="Share product" onPress={() => Share.share({ message: `${p.name} · EveryCation shop` })} />
          <IconButton tone="glass" icon={ShoppingBasket} label={`Basket, ${basketCount(basket)} items`} badge={basketCount(basket) || undefined} onPress={() => router.push('/shop/basket')} />
        </View></SafeAreaView>
        <View className="-mt-6 gap-4 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-1"><T v="eyebrow">{p.category.split(' & ')[0]!.toUpperCase()}{p.brand ? ` · ${p.brand.toUpperCase()}` : ''}</T><T v="h1">{p.name}</T><T v="h2" className="text-navy">{formatNaira(p.price)}</T></View>
          <T className="text-ink-muted">{p.description}</T>
          <View className="self-start rounded-full border-[1.5px] border-control-border px-4 py-2"><T v="label">Colour · {p.variant}</T></View>
          {p.pickedNote && <Note icon={Star} tone="gold">{p.pickedNote}</Note>}
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] flex-row gap-3 self-center px-5 py-3">
        <Button className="flex-1" variant="outline" label="Save for it" onPress={() => router.push({ pathname: '/wallet/new-goal', params: { name: p.name } })} />
        <Button className="flex-[1.4]" label={added ? 'VIEW BASKET' : 'ADD TO BASKET'} variant={added ? 'navy' : 'primary'} onPress={() => { if (added) return router.push('/shop/basket'); addToBasket(p.id); setAdded(true); }} />
      </View></SafeAreaView>
    </View>
  );
}
