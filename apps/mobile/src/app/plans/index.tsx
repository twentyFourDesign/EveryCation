import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, formatNaira } from '@everycation/shared';
import { Badge, Chips, Empty, Loading, Photo, Screen, T, colors, go, SearchBar } from '@/ui';
import { shortName } from '@/lib/people';
import { useApp } from '@/lib/store';

const filters = ['All', 'Free', 'Weekend', 'Creators', 'Saved'] as const;

export default function TripPlans() {
  const { data = [], isLoading } = useQuery({ queryKey: ['plans'], queryFn: api.plans });
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [term, setTerm] = useState('');
  const owned = useApp((s) => s.ownedPlans);
  const list = data.filter((p) => p.title.toLowerCase().includes(term.toLowerCase()))
    .filter((p) => filter === 'All' || (filter === 'Free' && p.price === 0) || (filter === 'Weekend' && p.days <= 3) || (filter === 'Creators' && p.price > 0) || (filter === 'Saved' && owned.includes(p.id)));
  return (
    <Screen title="Trip plans" right={<Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push('/creator-studio')} className="pr-2"><Text className="font-pop-sb text-[13px] text-heading-blue">Sell yours</Text></Pressable>}>
      <T className="-mt-3 text-ink-muted">Itineraries from travellers and creators</T>
      <SearchBar value={term} onChangeText={setTerm} placeholder="Where do you want to go?" accessibilityLabel="Search trip plans" />
      <Chips options={filters} value={filter} onChange={setFilter} />
      {isLoading && <Loading what="trip plans" />}
      {!isLoading && list.length === 0 && <Empty>{filter === 'Saved' ? 'Plans you buy or save show up here.' : 'No plans match.'}</Empty>}
      {list.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.title}, ${p.price ? formatNaira(p.price) : 'free'}`} onPress={() => go(`/plans/${p.id}`)} className="overflow-hidden rounded-card bg-surface-muted active:opacity-80">
          <Photo k={p.image} className="h-[150px]" />
          {p.badge && <View className="absolute left-3 top-3"><Badge tone="gold" label={p.badge} /></View>}
          <View className="flex-row items-center gap-3 p-3.5">
            <View className="flex-1 gap-0.5"><T v="strong">{p.title}</T>
              <View className="flex-row items-center gap-1"><T v="small">{shortName(p.authorId)} · {p.days} days · </T><Star size={12} color={colors.gold} fill={colors.gold} /><T v="small">{p.rating} ({p.reviews})</T></View></View>
            <T v="title" className="text-navy">{p.price ? formatNaira(p.price) : 'Free'}</T>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
