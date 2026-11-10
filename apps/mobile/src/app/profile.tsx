import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Settings, Store } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { api, sample } from '@everycation/shared';
import { Avatar, Button, IconButton, ListRow, Photo, Screen, SectionTitle, Stats, T, go } from '@/ui';

export default function Profile() {
  const me = sample.me;
  const { data: tips = [] } = useQuery({ queryKey: ['tips', 'wole'], queryFn: () => api.tips({ authorId: 'wole' }) });
  return (
    <Screen title="" right={<IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />}>
      <View className="items-center gap-2">
        <Avatar initials={me.initials} size={88} />
        <T v="h2">{me.name}</T><T v="small">{me.handle} · {me.city}</T>
        <T className="text-center">{me.bio}</T>
        <Button small variant="outline" label="Edit profile" onPress={() => router.push('/settings')} />
      </View>
      <Stats items={[[me.countries, 'countries'], [me.tips, 'tips'], [me.followers, 'followers'], [me.following ?? 0, 'following']]} />
      <ListRow icon={Store} title="Creator studio" subtitle="Share or sell your trip plans" onPress={() => router.push('/creator-studio')} />
      <SectionTitle>My tips</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {tips.map((t) => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => go(`/tip/${t.id}`)} className="w-[31.8%]"><Photo k={t.image} className="aspect-square rounded-xl" /></Pressable>)}
      </View>
    </Screen>
  );
}
