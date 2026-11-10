import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Badge, Chips, Empty, Loading, Note, Photo, Screen, SearchBar, T, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { usePlans } from '@/lib/plans';
import { tripImage } from '@/lib/trips';

const filters = { All: 'all', Free: 'free', Weekend: 'weekend', Paid: 'paid', 'My library': 'owned' } as const;

export default function TripPlans() {
  const [filter, setFilter] = useState<keyof typeof filters>('All');
  const [term, setTerm] = useState(''); const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(term.trim()), 250); return () => clearTimeout(t); }, [term]);
  const { data, isLoading, error } = usePlans(filters[filter], q);
  return (
    <Screen title="Trip plans" right={<Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push('/creator-studio')} className="pr-2"><Text className="font-pop-sb text-[13px] text-heading-blue">Sell yours</Text></Pressable>}>
      <T className="-mt-3 text-ink-muted">Itineraries from travellers who made the trip</T>
      <SearchBar value={term} onChangeText={setTerm} placeholder="Where do you want to go?" />
      <Chips options={Object.keys(filters) as (keyof typeof filters)[]} value={filter} onChange={setFilter} />
      {isLoading && <Loading what="trip plans" />}
      {!!error && <Note tone="danger">{errorMessage(error)}</Note>}
      {data?.length === 0 && <Empty>{filter === 'My library' ? 'Plans you buy or save show up here.' : 'No plans match yet. Finished a trip? Share yours.'}</Empty>}
      {data?.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.title}, ${p.price ? formatNaira(p.price) : 'free'}`} onPress={() => go(`/plans/${p.id}`)} className="overflow-hidden rounded-card bg-surface-muted active:opacity-80">
          <Photo k={tripImage({ id: p.tripId, imageKey: p.imageKey })} className="h-[150px]" />
          {p.owned && <View className="absolute left-3 top-3"><Badge tone="gold" label="In your library" /></View>}
          <View className="flex-row items-center gap-3 p-3.5">
            <View className="flex-1 gap-0.5"><T v="strong">{p.title}</T><T v="small">{p.author.name} · {p.days} day{p.days === 1 ? '' : 's'} · {p.stops} stops{p.used ? ` · used by ${p.used}` : ''}</T></View>
            <T v="title" className="text-navy">{p.price ? formatNaira(p.price) : 'Free'}</T>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
