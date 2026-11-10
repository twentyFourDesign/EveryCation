import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { api, sample } from '@everycation/shared';
import { Avatar, Badge, Button, Empty, IconButton, Photo, Screen, Segmented, Stats, T, go } from '@/ui';
import { useApp } from '@/lib/store';

const tabs = ['Tips', 'Places visited', 'Bucket list'] as const;

export default function TravellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: t } = useQuery({ queryKey: ['traveller', id], queryFn: () => api.traveller(id) });
  const { data: tips = [] } = useQuery({ queryKey: ['tips', id], queryFn: () => api.tips({ authorId: id }) });
  const [tab, setTab] = useState<(typeof tabs)[number]>('Tips');
  const { following, toggle } = useApp();
  if (!t) return null;
  const follows = following.includes(t.id);
  const share = () => Share.share({ message: `${t.name} on EveryCation · ${t.handle}` });
  return (
    <Screen title="" right={<IconButton icon={Share2} label="Share profile" onPress={share} />}>
      <View className="items-center gap-2">
        <Avatar initials={t.initials} size={88} />
        <T v="h2">{t.name}</T><T v="small">{t.handle} · {t.city}</T>
        {t.badge && <Badge label={t.badge} tone="gold" />}
        <T className="text-center">{t.bio}</T>
      </View>
      <Stats items={[[t.countries, 'countries'], [t.tips, 'tips'], [t.followers, 'followers']]} />
      <View className="flex-row gap-3">
        <Button className="flex-1" variant={follows ? 'outline' : 'primary'} label={follows ? 'FOLLOWING' : 'FOLLOW'} onPress={() => toggle('following', t.id)} />
        <Button className="flex-1" variant="outline" label="Share profile" onPress={share} />
      </View>
      <Segmented options={tabs} value={tab} onChange={setTab} />
      {tab === 'Tips' && (tips.length ? (
        <View className="flex-row flex-wrap gap-2">
          {tips.map((tip) => <Pressable key={tip.id} accessibilityRole="button" accessibilityLabel={tip.title} onPress={() => go(`/tip/${tip.id}`)} className="w-[31.8%]"><Photo k={tip.image} className="aspect-square rounded-xl" /></Pressable>)}
        </View>) : <Empty>No tips yet.</Empty>)}
      {tab === 'Places visited' && [...new Set(tips.map((x) => x.place))].map((p) => <T key={p} v="strong" className="border-b border-line py-3">{p}</T>)}
      {tab === 'Bucket list' && sample.bucketList.slice(1, 3).map((b) => <View key={b.id} className="flex-row items-center gap-3"><Photo k={b.image} className="h-14 w-14 rounded-xl" /><T v="strong">{b.title}</T></View>)}
    </Screen>
  );
}
