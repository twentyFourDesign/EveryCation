import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, formatNaira } from '@everycation/shared';
import { shortName as author } from '@/lib/people';
import { Chips, IconButton, Loading, Mark, Photo, Screen, SectionTitle, T, colors, go } from '@/ui';
import { useApp } from '@/lib/store';

const sections = ['For you', 'Community', 'Places', 'Trip plans', 'Advice'] as const;
const links: Record<string, string> = { Community: '/community', Places: '/place/bali', 'Trip plans': '/plans', Advice: '/advice' };

export default function Explore() {
  const tips = useQuery({ queryKey: ['tips'], queryFn: () => api.tips() });
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.plans });
  const unread = useApp((s) => !s.readNotifications);
  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2"><Mark size={30} color="brand" /><Text className="font-pop-sb text-lg text-navy">EveryCation</Text></View>
        <IconButton icon={Bell} label="Notifications" badge={unread ? 3 : undefined} onPress={() => router.push('/notifications')} />
      </View>
      <T v="h1">Where to next?</T>
      <Pressable accessibilityRole="search" accessibilityLabel="Search places, tips and trip plans" onPress={() => router.push('/search')} className="h-[52px] flex-row items-center gap-3 rounded-full bg-surface-muted px-4">
        <Search size={20} color={colors.inkMuted} /><T className="text-ink-muted">Search places, tips, trip plans</T>
      </Pressable>
      <Chips options={sections} value="For you" onChange={(s) => links[s] && go(links[s])} />

      <SectionTitle action="See all" onAction={() => router.push('/community')}>Tips from travellers</SectionTitle>
      {tips.isLoading ? <Loading what="tips" /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5">
          {tips.data?.slice(0, 4).map((t) => (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`${t.title}, tip by ${author(t.authorId)}`} onPress={() => go(`/tip/${t.id}`)} className="w-[250px] overflow-hidden rounded-card bg-surface-muted active:opacity-80">
              <Photo k={t.image} className="h-[150px]" />
              <View className="gap-1 p-3.5"><T v="eyebrow">{t.region}</T><T v="strong" numberOfLines={2}>{t.title}</T><T v="small">by {author(t.authorId)} · {t.readMins} min read</T></View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <SectionTitle action="See all" onAction={() => router.push('/plans')}>Trip plans by creators</SectionTitle>
      {plans.data?.slice(0, 2).map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.title} by ${author(p.authorId)}`} onPress={() => go(`/plans/${p.id}`)} className="flex-row gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
          <Photo k={p.image} className="h-[88px] w-[88px] rounded-2xl" />
          <View className="flex-1 justify-center gap-0.5">
            <T v="strong" numberOfLines={1}>{p.title}</T>
            <T v="small">by {author(p.authorId)} · {p.stops} stops · {p.rating} rating</T>
            <T v="strong" className="text-navy">{p.price ? formatNaira(p.price) : 'Free'}</T>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
